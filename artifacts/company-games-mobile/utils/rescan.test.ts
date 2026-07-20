import { describe, it, expect } from 'vitest';
import { parseQrToken } from './parseQrToken';
import { resolveRescan, RESCAN_NOT_FOUND } from './rescan';

describe('parseQrToken', () => {
  it('extrahiert Token aus URL mit ?token=', () => {
    expect(parseQrToken('https://cg26.example.com/checkin?token=xyz789')).toBe('xyz789');
  });

  it('nimmt letzten Pfad-Teil einer URL ohne token-Param', () => {
    expect(parseQrToken('https://cg26.example.com/team/tok42')).toBe('tok42');
  });

  it('gibt Rohwert (getrimmt) zurück, wenn keine URL', () => {
    expect(parseQrToken('  rawtoken  ')).toBe('rawtoken');
  });
});

describe('resolveRescan', () => {
  it('wechselt auf ein verifiziertes Team und signalisiert Reset der Eingaben', () => {
    expect(resolveRescan({ verified: true, teamId: 'team-9', teamName: 'Die Adler' })).toEqual({
      ok: true,
      teamId: 'team-9',
      teamName: 'Die Adler',
      resetValues: true,
    });
  });

  it('nutzt "Team" als Fallback-Namen', () => {
    const out = resolveRescan({ verified: true, teamId: 'team-9' });
    expect(out).toEqual({ ok: true, teamId: 'team-9', teamName: 'Team', resetValues: true });
  });

  it('meldet Fehler bei nicht verifiziertem QR-Code', () => {
    expect(resolveRescan({ verified: false, teamId: 'team-9' })).toEqual({
      ok: false,
      error: RESCAN_NOT_FOUND,
    });
  });

  it('meldet Fehler ohne teamId', () => {
    expect(resolveRescan({ verified: true })).toEqual({ ok: false, error: RESCAN_NOT_FOUND });
  });

  it('meldet Fehler bei null (Netzwerk-/Serverfehler)', () => {
    expect(resolveRescan(null)).toEqual({ ok: false, error: RESCAN_NOT_FOUND });
  });
});
