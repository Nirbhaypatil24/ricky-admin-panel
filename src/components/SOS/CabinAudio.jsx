import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Headphones, Mic, Square, Volume2 } from 'lucide-react';
import { getConnection } from '../../lib/config';
import { sosService, errorMessage } from '../../lib/api';

/**
 * Cabin audio for one SOS.
 *  - Live: the meter's cabin microphone (INMP441) streams while SOS is on. The backend relays
 *    it on /ws-audio as 16-bit mono PCM chunks; we play them with the Web Audio API, about
 *    0.4 s behind real time (a small buffer absorbs mobile-network jitter).
 *  - Recording: the whole SOS audio, saved on the server, as a WAV to replay or download.
 */

function audioWsUrl(driverId) {
  const conn = getConnection();
  try {
    const u = new URL(conn.wsUrl);
    u.pathname = u.pathname.replace(/\/ws-ricky\/?$/, '').replace(/\/+$/, '') + '/ws-audio';
    u.search = '';
    u.searchParams.set('driverId', driverId);
    if (conn.adminKey) u.searchParams.set('key', conn.adminKey);
    return u.toString();
  } catch {
    return '';
  }
}

const JITTER_S = 0.4; // playback delay that absorbs network jitter
const MAX_LAG_S = 3; // further behind than this -> drop audio to catch up

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function useLivePlayer(driverId) {
  const [state, setState] = useState('idle'); // idle | connecting | waiting | live | ended | error
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(0); // seconds of audio played in this session
  const [volume, setVolumeState] = useState(2);
  const r = useRef({});

  const stop = useCallback(() => {
    const s = r.current;
    s.stopped = true;
    clearTimeout(s.retry);
    clearInterval(s.watch);
    try {
      s.ws?.close();
    } catch {
      /* already closed */
    }
    try {
      s.ctx?.close();
    } catch {
      /* already closed */
    }
    r.current = {};
    setState('idle');
    setLevel(0);
  }, []);

  const connect = useCallback(() => {
    const s = r.current;
    const url = audioWsUrl(driverId);
    if (!url) {
      setState('error');
      return;
    }
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    s.ws = ws;
    setState((st) => (st === 'live' ? 'waiting' : 'connecting'));
    ws.onopen = () => setState('waiting');
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          const m = JSON.parse(ev.data);
          if (m.sampleRate) s.rate = m.sampleRate;
          if (m.type === 'end') setState('ended');
        } catch {
          /* ignore */
        }
        return;
      }
      const ctx = s.ctx;
      if (!ctx) return;
      const pcm = new Int16Array(ev.data);
      if (!pcm.length) return;
      const f = new Float32Array(pcm.length);
      let sum = 0;
      for (let i = 0; i < pcm.length; i++) {
        const v = pcm[i] / 32768;
        f[i] = v;
        sum += v * v;
      }
      const now = ctx.currentTime;
      if (s.next < now + 0.02) s.next = now + JITTER_S; // first chunk or after a gap
      if (s.next - now > MAX_LAG_S) return; // too far behind (e.g. backlog after a network drop)
      const buf = ctx.createBuffer(1, f.length, s.rate || 16000);
      buf.copyToChannel(f, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(s.gain);
      src.start(s.next);
      s.next += buf.duration;
      s.lastData = Date.now();
      s.heard = (s.heard || 0) + buf.duration;
      setHeard(s.heard);
      setLevel(Math.min(1, Math.sqrt(sum / f.length) * 4 * (s.gain?.gain.value || 1)));
      setState('live');
    };
    ws.onclose = () => {
      if (s.stopped || r.current !== s) return;
      // reconnect while the SOS is open (network blip, server restart)
      setState((st) => (st === 'ended' ? 'ended' : 'connecting'));
      s.retry = setTimeout(() => r.current === s && !s.stopped && connect(), 2000);
    };
  }, [driverId]);

  const start = useCallback(() => {
    stop();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      setState('error');
      return;
    }
    const ctx = new AC();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);
    ctx.resume?.();
    r.current = { ctx, gain, next: 0, rate: 16000, heard: 0 };
    setHeard(0);
    r.current.watch = setInterval(() => {
      const s = r.current;
      if (!s.ctx) return;
      if (s.lastData && Date.now() - s.lastData > 3000) {
        setLevel(0);
        setState((st) => (st === 'live' ? 'waiting' : st));
      }
    }, 500);
    connect();
  }, [connect, stop, volume]);

  const setVolume = (v) => {
    setVolumeState(v);
    if (r.current.gain) r.current.gain.gain.value = v;
  };

  useEffect(() => stop, [stop]);
  return { state, level, heard, start, stop, volume, setVolume, active: state !== 'idle' };
}

function LevelBar({ level, live }) {
  const bars = 16;
  const lit = Math.round(level * bars);
  return (
    <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={`w-1.5 rounded-sm transition-[height] duration-100 ${live && i < lit ? (i > bars * 0.8 ? 'bg-signal' : 'bg-ok') : 'bg-line'}`}
          style={{ height: `${30 + (i / bars) * 70}%` }}
        />
      ))}
    </div>
  );
}

const STATE_TEXT = {
  connecting: 'Connecting…',
  waiting: 'Connected. Waiting for audio from the vehicle…',
  live: 'Live',
  ended: 'The vehicle stopped sending audio (SOS cleared).',
  error: "This browser can't play live audio.",
};

export default function CabinAudio({ alert: a, isOpen, autoStart = false }) {
  const player = useLivePlayer(a.driverId);
  const [rec, setRec] = useState({ url: null, loading: false, error: null, seconds: 0 });
  const started = useRef(false);
  const audio = a.audio;

  useEffect(() => {
    if (autoStart && isOpen && !started.current) {
      started.current = true;
      player.start();
    }
  }, [autoStart, isOpen, player]);

  useEffect(() => {
    if (!isOpen && player.active && player.state !== 'live') player.stop();
  }, [isOpen, player]);

  useEffect(() => () => rec.url && URL.revokeObjectURL(rec.url), [rec.url]);

  const loadRecording = async () => {
    setRec((r0) => ({ ...r0, loading: true, error: null }));
    try {
      const { data } = await sosService.audio(a.id);
      setRec((r0) => {
        if (r0.url) URL.revokeObjectURL(r0.url);
        return { url: URL.createObjectURL(data), loading: false, error: null, seconds: audio?.seconds || 0 };
      });
    } catch (e) {
      setRec((r0) => ({ ...r0, loading: false, error: errorMessage(e, "Couldn't load the recording") }));
    }
  };

  const live = player.state === 'live';
  const showLive = isOpen || player.active;
  if (!showLive && !audio?.available) return null;

  return (
    <section className="border-t border-line px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-muted">
          <Mic className="h-4 w-4" /> Cabin audio
          {audio?.live && !player.active && <span className="rounded-full bg-signal px-2 py-0.5 text-xs font-bold text-white">ON AIR</span>}
        </h3>
        {audio?.available && (
          <span className="text-xs text-muted">
            {audio.live || player.state === 'live' ? 'Being recorded on the server' : `Recorded ${mmss(audio.seconds || 0)} on the server`}
          </span>
        )}
      </div>

      {showLive && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          {!player.active ? (
            <button className="btn-danger" onClick={player.start}>
              <Headphones /> Listen live
            </button>
          ) : (
            <button className="btn-dark" onClick={player.stop}>
              <Square /> Stop listening
            </button>
          )}
          {player.active && (
            <>
              <LevelBar level={player.level} live={live} />
              <div className="min-w-0 text-sm">
                {live ? (
                  <span className="font-semibold text-signal">
                    <span className="beacon mr-1.5 inline-block h-2 w-2 rounded-full bg-signal align-middle" />
                    LIVE · {mmss(player.heard)}
                  </span>
                ) : (
                  <span className="text-muted">{STATE_TEXT[player.state]}</span>
                )}
              </div>
              <label className="ml-auto flex items-center gap-2 text-sm text-muted">
                <Volume2 className="h-4 w-4" />
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={player.volume}
                  onChange={(e) => player.setVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="w-24 accent-current"
                />
              </label>
            </>
          )}
          {!player.active && (
            <p className="text-sm text-muted">
              {audio?.live
                ? 'The vehicle is sending cabin audio now.'
                : 'The meter sends cabin audio while SOS is on. You hear it about a second after it is spoken.'}
            </p>
          )}
        </div>
      )}

      {audio?.available && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {rec.url ? (
            <>
              <audio controls src={rec.url} className="h-9 max-w-full flex-1" />
              <a className="btn-ghost btn-sm" href={rec.url} download={`${a.id}.wav`}>
                <Download /> WAV
              </a>
            </>
          ) : null}
          <button className="btn-ghost btn-sm" onClick={loadRecording} disabled={rec.loading}>
            {rec.loading ? 'Loading…' : rec.url ? 'Reload recording' : 'Play recording'}
          </button>
          {rec.error && <span className="text-sm text-signal">{rec.error}</span>}
        </div>
      )}
    </section>
  );
}
