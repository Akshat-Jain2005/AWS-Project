
from .. import config as C


def unionized_fraction(ph, temp_c):
    pka = 0.09018 + 2729.92 / (temp_c + 273.15)
    return 1.0 / (10 ** (pka - ph) + 1.0)


def unionized_ammonia(total_ppm, ph, temp_c):
    return total_ppm * unionized_fraction(ph, temp_c)


def band(uia_mgl):
    if uia_mgl >= C.UIA_DANGER_MGL:
        return "DANGEROUS"
    if uia_mgl >= C.UIA_WATCH_MGL:
        return "ELEVATED"
    return "SAFE"


def assess(total_ppm, ph, temp_c):
    f = unionized_fraction(ph, temp_c)
    uia = total_ppm * f
    return {
        "total_ammonia_ppm": round(total_ppm, 3),
        "ph": ph,
        "temperature_c": temp_c,
        "unionized_fraction": round(f, 4),
        "unionized_ammonia_mgl": round(uia, 4),
        "band": band(uia),
        "heat_multiplier_vs_25c": round(f / unionized_fraction(ph, 25.0), 2),
    }


def heat_curve(total_ppm, ph, temps=range(15, 51, 5)):
    return [{"temperature_c": t, "unionized_ammonia_mgl": round(unionized_ammonia(total_ppm, ph, t), 4)}
            for t in temps]
