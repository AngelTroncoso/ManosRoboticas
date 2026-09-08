"""
Módulo de Filtrado Temporal: EMA y Filtro 1€ (One Euro Filter)
Elimina el temblor (jitter) en la estimación de landmarks y ángulos articulares
sin introducir retardo perceptible en movimientos rápidos.
"""

import math
import time
from typing import Dict, Optional


class EMAFilter:
    """Filtro de Media Móvil Exponencial simple y de muy bajo costo."""

    def __init__(self, alpha: float = 0.35):
        self.alpha = max(0.01, min(1.0, alpha))
        self.value: Optional[float] = None

    def filter(self, x: float) -> float:
        if self.value is None:
            self.value = x
        else:
            self.value = self.alpha * x + (1.0 - self.alpha) * self.value
        return self.value

    def reset(self):
        self.value = None


class LowPassFilter:
    """Filtro pasa-bajos de primer orden con frecuencia de corte dinámica."""

    def __init__(self, alpha: float = 0.5):
        self.alpha = alpha
        self.prev_val: Optional[float] = None

    def filter(self, val: float, alpha: Optional[float] = None) -> float:
        if alpha is not None:
            self.alpha = alpha
        if self.prev_val is None:
            self.prev_val = val
            return val
        filtered = self.alpha * val + (1.0 - self.alpha) * self.prev_val
        self.prev_val = filtered
        return filtered

    def reset(self):
        self.prev_val = None


class OneEuroFilter:
    """
    Filtro 1€ (One Euro Filter) adaptativo por Casiez, Roussel y Vogel.
    A bajas velocidades reduce jitter agresivamente (min_cutoff).
    A altas velocidades prioriza cero latencia (beta).
    """

    def __init__(
        self,
        min_cutoff: float = 1.0,
        beta: float = 0.007,
        d_cutoff: float = 1.0,
    ):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff

        self.x_filt = LowPassFilter()
        self.dx_filt = LowPassFilter()
        self.last_time: Optional[float] = None

    def _alpha(self, cutoff: float, dt: float) -> float:
        tau = 1.0 / (2.0 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def filter(self, x: float, timestamp: Optional[float] = None) -> float:
        if timestamp is None:
            timestamp = time.time()

        if self.last_time is None:
            self.last_time = timestamp
            return self.x_filt.filter(x, 1.0)

        dt = max(1e-4, timestamp - self.last_time)
        self.last_time = timestamp

        # Derivada / velocidad estimada
        dx = (x - (self.x_filt.prev_val if self.x_filt.prev_val is not None else x)) / dt
        edx = self.dx_filt.filter(dx, self._alpha(self.d_cutoff, dt))

        # Frecuencia de corte adaptativa: aumenta con la velocidad de movimiento
        cutoff = self.min_cutoff + self.beta * abs(edx)
        return self.x_filt.filter(x, self._alpha(cutoff, dt))

    def reset(self):
        self.x_filt.reset()
        self.dx_filt.reset()
        self.last_time = None


class JointFilterBank:
    """Banco de filtros independientes para todos los servos/grados de libertad de una mano."""

    def __init__(self, use_one_euro: bool = True, alpha_ema: float = 0.4):
        self.use_one_euro = use_one_euro
        self.alpha_ema = alpha_ema
        self.filters: Dict[str, OneEuroFilter | EMAFilter] = {}

    def filter_value(self, key: str, value: float, ts: Optional[float] = None) -> float:
        if key not in self.filters:
            if self.use_one_euro:
                self.filters[key] = OneEuroFilter(min_cutoff=1.2, beta=0.01)
            else:
                self.filters[key] = EMAFilter(alpha=self.alpha_ema)

        f = self.filters[key]
        if isinstance(f, OneEuroFilter):
            return f.filter(value, ts)
        return f.filter(value)

    def reset(self):
        for f in self.filters.values():
            f.reset()
