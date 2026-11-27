#!/usr/bin/env python3
"""
Original procedural SFX from Gemini Neon, adapted for Marketing Training Lab
Generates 5 original SFX keys compliant with docs/AUDIO_SPEC.md:
  - Format: OGG Vorbis (.ogg)
  - Sample rate: 44,100 Hz
  - Channels: Mono (1 ch)
  - Peak level: <= -3.0 dBFS
  - File size: <= 200 KB

Keys generated:
  1. step_shop.ogg   - Soft tile-floor footstep in store
  2. shelf_pick.ogg    - Tactile product touch/pickup from shelf
  3. notebook.ogg     - Two-stroke pen/pencil jot in observation notebook
  4. scanner.ogg     - Clean retail barcode scanner beep
  5. cash_change.ogg  - Multi-coin metallic clink for cash change

Usage:
  python tools/make_walk_sfx.py --out-dir game/assets/audio
"""

import argparse
import os
import subprocess
import tempfile
import wave
import numpy as np
from scipy.signal import butter, filtfilt

SR = 44100


def bandpass(sig: np.ndarray, low: float, high: float, order: int = 3) -> np.ndarray:
    nyq = 0.5 * SR
    b, a = butter(order, [low / nyq, high / nyq], btype="band")
    return filtfilt(b, a, sig)


def highpass(sig: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    nyq = 0.5 * SR
    b, a = butter(order, cutoff / nyq, btype="high")
    return filtfilt(b, a, sig)


def lowpass(sig: np.ndarray, cutoff: float, order: int = 3) -> np.ndarray:
    nyq = 0.5 * SR
    b, a = butter(order, cutoff / nyq, btype="low")
    return filtfilt(b, a, sig)


def apply_edge_fades(sig: np.ndarray, fade_in_ms: float = 3.0, fade_out_ms: float = 8.0) -> np.ndarray:
    out = sig.copy()
    n_in = min(int(SR * fade_in_ms / 1000.0), len(out) // 3)
    n_out = min(int(SR * fade_out_ms / 1000.0), len(out) // 3)
    if n_in > 1:
        out[:n_in] *= 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, n_in)))
    if n_out > 1:
        out[-n_out:] *= 0.5 * (1.0 + np.cos(np.pi * np.linspace(0.0, 1.0, n_out)))
    return out


def normalize_peak_dbfs(sig: np.ndarray, target_dbfs: float) -> np.ndarray:
    sig = sig - np.mean(sig)  # remove DC offset
    peak = np.max(np.abs(sig))
    if peak <= 1e-12:
        return sig
    target_amp = 10.0 ** (target_dbfs / 20.0)
    return sig * (target_amp / peak)


def synth_step_store() -> np.ndarray:
    """1. step_store: Soft rubber-sole footstep on ceramic grocery store tile (0.16 s, -15.0 dBFS)."""
    rng = np.random.default_rng(101)
    dur = 0.16
    n = int(SR * dur)
    t = np.arange(n) / SR

    # Low heel-strike thump (pitch sweep 98 Hz -> 52 Hz)
    f_sweep = 52.0 + 46.0 * np.exp(-t / 0.022)
    phase = 2.0 * np.pi * np.cumsum(f_sweep) / SR
    thump = np.sin(phase) * np.exp(-t / 0.026) * (1.0 - np.exp(-t / 0.003))

    # Mid-low tile contact texture (140 - 850 Hz)
    noise1 = bandpass(rng.standard_normal(n), 140.0, 850.0, order=3)
    env1 = np.exp(-t / 0.024) * (1.0 - np.exp(-t / 0.002))

    # Subtle toe-scuff transient starting at 48 ms (900 - 2600 Hz)
    t2 = np.maximum(0.0, t - 0.048)
    mask2 = (t >= 0.048).astype(float)
    noise2 = bandpass(rng.standard_normal(n), 900.0, 2600.0, order=2)
    env2 = mask2 * np.exp(-t2 / 0.022) * (1.0 - np.exp(-t2 / 0.004))

    sig = 0.72 * thump + 0.45 * noise1 * env1 + 0.14 * noise2 * env2
    sig = lowpass(sig, 3800.0, order=2)
    sig = apply_edge_fades(sig, fade_in_ms=2.0, fade_out_ms=15.0)
    return normalize_peak_dbfs(sig, -15.0)


def synth_item_pick() -> np.ndarray:
    """2. item_pick: Tactile product touch / lift from shelf (0.18 s, -9.0 dBFS)."""
    rng = np.random.default_rng(202)
    dur = 0.18
    n = int(SR * dur)
    t = np.arange(n) / SR

    # Initial shelf tap / finger contact (1.2 - 4.8 kHz)
    tap_noise = bandpass(rng.standard_normal(n), 1200.0, 4800.0, order=3)
    tap_env = np.exp(-t / 0.011) * (1.0 - np.exp(-t / 0.0015))

    # Hollow plastic/bottle upward lift pop (390 Hz -> 520 Hz + subtle overtone)
    t_pop = np.maximum(0.0, t - 0.012)
    mask_pop = (t >= 0.012).astype(float)
    f_pop = 390.0 + 130.0 * (1.0 - np.exp(-t_pop / 0.025))
    ph_pop = 2.0 * np.pi * np.cumsum(f_pop) / SR
    pop = mask_pop * (
        0.80 * np.sin(ph_pop) * np.exp(-t_pop / 0.032)
        + 0.25 * np.sin(2.42 * ph_pop) * np.exp(-t_pop / 0.018)
    ) * (1.0 - np.exp(-t_pop / 0.002))

    # Soft package rustle / grip tail (2.2 - 6.0 kHz)
    t_rust = np.maximum(0.0, t - 0.032)
    mask_rust = (t >= 0.032).astype(float)
    rustle = bandpass(rng.standard_normal(n), 2200.0, 6000.0, order=2)
    rust_env = mask_rust * np.exp(-t_rust / 0.040) * (1.0 - np.exp(-t_rust / 0.008))

    sig = 0.55 * tap_noise * tap_env + 0.85 * pop + 0.22 * rustle * rust_env
    sig = apply_edge_fades(sig, fade_in_ms=2.0, fade_out_ms=16.0)
    return normalize_peak_dbfs(sig, -9.0)


def synth_note_jot() -> np.ndarray:
    """3. note_jot: Two-stroke pencil/pen jot in observation notebook (0.24 s, -10.0 dBFS)."""
    rng = np.random.default_rng(303)
    dur = 0.24
    n = int(SR * dur)
    t = np.arange(n) / SR

    # Paper grain noise layers
    grain_hi = bandpass(rng.standard_normal(n), 1800.0, 6200.0, order=3)
    grain_mid = bandpass(rng.standard_normal(n), 650.0, 1500.0, order=2)

    # Stroke 1: 0.008s - 0.095s (quick downward stroke)
    s1 = np.exp(-0.5 * ((t - 0.048) / 0.022) ** 2) * (t >= 0.005)
    # Stroke 2: 0.115s - 0.215s (slightly longer horizontal stroke)
    s2 = np.exp(-0.5 * ((t - 0.162) / 0.028) ** 2) * (t >= 0.105)

    # Natural paper fiber micro-modulation
    mod = 0.72 + 0.28 * np.sin(2.0 * np.pi * 68.0 * t + 0.4 * np.sin(2.0 * np.pi * 19.0 * t))

    # Soft pen-tip tap at onset of stroke 1 and 2
    tip1 = np.exp(-np.maximum(0.0, t - 0.012) / 0.005) * (t >= 0.012) * np.sin(2.0 * np.pi * 1350.0 * t)
    tip2 = np.exp(-np.maximum(0.0, t - 0.118) / 0.005) * (t >= 0.118) * np.sin(2.0 * np.pi * 1520.0 * t)

    strokes = (0.95 * s1 + 0.82 * s2) * mod
    sig = strokes * (0.78 * grain_hi + 0.32 * grain_mid) + 0.18 * (tip1 + 0.8 * tip2)
    sig = apply_edge_fades(sig, fade_in_ms=3.0, fade_out_ms=16.0)
    return normalize_peak_dbfs(sig, -10.0)


def synth_pos_scan() -> np.ndarray:
    """4. pos_scan: Crisp grocery POS barcode scanner beep (0.14 s, -8.0 dBFS)."""
    rng = np.random.default_rng(404)
    dur = 0.14
    n = int(SR * dur)
    t = np.arange(n) / SR

    f0 = 2480.0
    # Piezo scanner tone with subtle odd/even harmonics
    tone = (
        1.00 * np.sin(2.0 * np.pi * f0 * t)
        + 0.08 * np.sin(2.0 * np.pi * (2.0 * f0) * t + 0.3)
        + 0.03 * np.sin(2.0 * np.pi * (3.0 * f0) * t + 0.7)
    )

    # Smooth gate: 4 ms attack, hold until 102 ms, 26 ms smooth decay
    env = np.ones(n)
    n_att = int(SR * 0.004)
    n_rel_start = int(SR * 0.102)
    env[:n_att] = 0.5 * (1.0 - np.cos(np.pi * np.linspace(0.0, 1.0, n_att)))
    rel_t = np.arange(n - n_rel_start) / SR
    env[n_rel_start:] = np.exp(-rel_t / 0.011)

    # Tiny trigger micro-click at onset
    click = bandpass(rng.standard_normal(n), 3000.0, 7000.0, order=2) * np.exp(-t / 0.0025)

    sig = tone * env + 0.06 * click
    sig = apply_edge_fades(sig, fade_in_ms=2.0, fade_out_ms=10.0)
    return normalize_peak_dbfs(sig, -8.0)


def synth_cash_change() -> np.ndarray:
    """5. cash_change: Multi-coin metallic clink & tray settle for change (0.32 s, -8.0 dBFS)."""
    rng = np.random.default_rng(505)
    dur = 0.32
    n = int(SR * dur)
    t = np.arange(n) / SR

    sig = np.zeros(n)

    # Three staggered coin clinks (inharmonic metallic modes)
    coins = [
        (0.004, 2620.0, 0.85, 0.075),
        (0.068, 3140.0, 1.00, 0.095),
        (0.136, 2860.0, 0.72, 0.105),
    ]
    mode_ratios = [(1.00, 1.00, 1.0), (1.59, 0.55, 0.82), (2.14, 0.35, 0.65), (2.86, 0.22, 0.50), (3.65, 0.12, 0.38)]

    for onset, base_f, amp, decay in coins:
        tk = np.maximum(0.0, t - onset)
        mask = (t >= onset).astype(float)
        coin_wave = np.zeros(n)
        for ratio, m_amp, d_scale in mode_ratios:
            freq = base_f * ratio
            if freq < 0.45 * SR:
                phase = rng.uniform(0, 2 * np.pi)
                coin_wave += m_amp * np.sin(2.0 * np.pi * freq * tk + phase) * np.exp(-tk / (decay * d_scale))
        attack = 1.0 - np.exp(-tk / 0.0012)
        # Brief metallic impact transient
        impact = bandpass(rng.standard_normal(n), 4500.0, 10500.0, order=2) * np.exp(-tk / 0.004)
        sig += mask * amp * (coin_wave * attack + 0.18 * impact)

    # Subtle cash-tray settle thud at onset
    tray = np.sin(2.0 * np.pi * 235.0 * t) * np.exp(-t / 0.018) * (1.0 - np.exp(-t / 0.002))
    sig += 0.22 * tray

    sig = apply_edge_fades(sig, fade_in_ms=2.0, fade_out_ms=22.0)
    return normalize_peak_dbfs(sig, -8.0)


def write_ogg(sig: np.ndarray, ogg_path: str) -> None:
    pcm16 = np.clip(sig * 32767.0, -32768, 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    try:
        with wave.open(wav_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SR)
            wf.writeframes(pcm16.tobytes())
        subprocess.run(
            [
                "ffmpeg", "-y", "-loglevel", "error",
                "-i", wav_path,
                "-c:a", "libvorbis", "-q:a", "5",
                "-ar", str(SR), "-ac", "1",
                ogg_path,
            ],
            check=True,
        )
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Synthesize 5 original SFX keys (.ogg) for Grocery Sim Training.")
    parser.add_argument("--out-dir", default=".", help="Output directory for .ogg files")
    args = parser.parse_args()
    os.makedirs(args.out_dir, exist_ok=True)

    generators = {
        "step_shop": synth_step_store,
        "shelf_pick": synth_item_pick,
        "notebook": synth_note_jot,
        "scanner": synth_pos_scan,
        "cash_change": synth_cash_change,
    }

    for key, fn in generators.items():
        sig = fn()
        out_path = os.path.join(args.out_dir, f"{key}.ogg")
        write_ogg(sig, out_path)
        peak_db = 20.0 * np.log10(np.max(np.abs(sig)) + 1e-12)
        rms_db = 20.0 * np.log10(np.sqrt(np.mean(sig ** 2)) + 1e-12)
        size_kb = os.path.getsize(out_path) / 1024.0
        print(f"{key}.ogg | dur={len(sig)/SR:.3f}s | synth_peak={peak_db:.2f} dBFS | rms={rms_db:.2f} dBFS | size={size_kb:.2f} KB")


if __name__ == "__main__":
    main()
