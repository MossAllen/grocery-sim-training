// Render the original 32-second store loop using the vendored ZzFX synth and FFmpeg.
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const game = path.join(__dirname, '..', 'game');
const sampleRate = 44100;
const barSeconds = 2;
const bars = 16;
const mix = new Float32Array(sampleRate * barSeconds * bars);

class OfflineAudio {
  createBuffer(_channels, length) {
    const samples = new Float32Array(length);
    return { getChannelData: () => samples };
  }

  createBufferSource() { return { connect() {}, start() {} }; }
}

const synth = vm.runInNewContext(`${readFileSync(path.join(game, 'vendor', 'zzfx', 'ZzFXMicro.js'), 'utf8')}\nzzfx;`,
  { AudioContext: OfflineAudio });

function note(midi, start, volume, sustain, release, shape) {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const source = synth(volume, 0, frequency, 0.025, sustain, release, shape, 1.4);
  const samples = source.buffer.getChannelData(0);
  const from = Math.round(start * sampleRate);
  for (let i = 0; i < samples.length; i++) mix[(from + i) % mix.length] += samples[i];
}

const chords = [
  [48, 55, 62, 64], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 57, 62],
];
const melody = [
  [67, 64, 62], [64, 60, 62], [65, 69, 67], [62, 67, 64],
  [64, 67, 69], [67, 64, 60], [62, 65, 69], [67, 62, 64],
];

for (let bar = 0; bar < bars; bar++) {
  const time = bar * barSeconds;
  const [root, fifth, upper, top] = chords[bar % chords.length];
  note(root, time, 0.42, 0.16, 0.49, 0);
  note(fifth, time + 0.75, 0.18, 0.12, 0.38, 0);
  note(upper, time + 0.5, 0.19, 0.09, 0.34, 1);
  note(top, time + 1, 0.15, 0.06, 0.31, 1);
  melody[bar % melody.length].forEach((pitch, i) => {
    note(pitch, time + 0.25 + 0.5 * i, 0.15 - i * 0.025, 0.045, 0.26, 0);
  });
}

// Low filtered motion under the music, also periodic across the loop boundary.
const tau = Math.PI * 2;
for (let i = 0; i < mix.length; i++) {
  const phase = tau * i / mix.length;
  const slow = 0.5 + 0.5 * Math.sin(phase * 3);
  mix[i] += slow * (Math.sin(phase * 1667) + 0.5 * Math.sin(phase * 1823)) * 0.012;
}

const output = path.join(game, 'assets', 'audio', 'bgm_store.ogg');
const encode = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(sampleRate),
  '-ac', '1', '-i', 'pipe:0', '-c:a', 'libvorbis', '-q:a', '3', output],
  { input: Buffer.from(mix.buffer), encoding: 'utf8' });
if (encode.error) throw encode.error;
if (encode.status !== 0) throw new Error(encode.stderr);
console.log(output);
