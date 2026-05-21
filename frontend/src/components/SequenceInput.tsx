import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { MoleculeInput, predictStructure, checkNimStatus, PredictResponse } from '../utils/api';

// ── Base colors for visualization ───────────────────────────────────────────
const BASE_COLORS: Record<string, string> = {
  A: '#e74c3c', T: '#3498db', C: '#2ecc71', G: '#f39c12',
  U: '#9b59b6',
};

const COMPLEMENTS: Record<string, string> = {
  A: 'T', T: 'A', C: 'G', G: 'C',
  a: 't', t: 'a', c: 'g', g: 'c'
};

interface SequenceInputProps {
  onPredictionComplete: (result: PredictResponse) => void;
}

// ── Antiparallel DNA strands visualization ──────────────────────────────────
function AntiparallelDnaPreview({ strand1, strand2 }: { strand1: string; strand2: string }) {
  const s1 = strand1.toUpperCase().replace(/[^ATCGU]/g, '');
  const s2 = strand2.toUpperCase().replace(/[^ATCGU]/g, '');

  if (!s1 && !s2) return null;

  // We align them antiparallel:
  // Strand 1: 5' ────> 3' (Left to Right)
  // Strand 2: 3' <──── 5' (Left to Right, so we render s2 reversed)
  const s2Reversed = s2.split('').reverse().join('');
  const maxLength = Math.max(s1.length, s2Reversed.length);

  return (
    <div className="mt-4 p-4 bg-slate-950/80 rounded-xl border border-slate-800 overflow-x-auto shadow-inner">
      <div className="text-[11px] font-bold text-slate-400 mb-3 flex items-center justify-between">
        <span>Dual-Strand Hybridization Preview</span>
        <span className="text-[10px] text-slate-500 font-normal">Antiparallel Alignment</span>
      </div>

      <div className="flex flex-col gap-1 min-w-max pb-2">
        {/* Strand 1 (5' -> 3') */}
        <div className="flex items-center gap-1">
          <span className="w-8 text-right font-mono text-[10px] text-cyan-400 font-bold pr-1">5'</span>
          {Array.from({ length: maxLength }).map((_, i) => {
            const base = s1[i] || '';
            return (
              <div
                key={`s1-${i}`}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white transition-all shadow-sm"
                style={{
                  backgroundColor: base ? (BASE_COLORS[base] || '#555') : 'transparent',
                  border: base ? 'none' : '1px dashed #334155'
                }}
              >
                {base || '-'}
              </div>
            );
          })}
          <span className="w-8 text-left font-mono text-[10px] text-cyan-400 font-bold pl-1">3'</span>
          <span className="text-[9px] text-slate-500 ml-2 font-mono">({s1.length} nt)</span>
        </div>

        {/* Pairing Lines */}
        <div className="flex items-center gap-1 h-5">
          <span className="w-8" /> {/* Spacer */}
          {Array.from({ length: maxLength }).map((_, i) => {
            const base1 = s1[i] || '';
            const base2 = s2Reversed[i] || '';
            
            let lineType = 'none';
            if (base1 && base2) {
              lineType = COMPLEMENTS[base1] === base2 ? 'match' : 'mismatch';
            }

            return (
              <div key={`line-${i}`} className="w-6 flex justify-center items-center">
                {lineType === 'match' && (
                  <div className="w-0.5 h-full bg-emerald-500/80 rounded-full" title="Watson-Crick Pair" />
                )}
                {lineType === 'mismatch' && (
                  <div className="w-0.5 h-full border-l border-dashed border-rose-500/60" title="Mismatch" />
                )}
                {lineType === 'none' && <div className="h-full w-px bg-transparent" />}
              </div>
            );
          })}
          <span className="w-8" />
        </div>

        {/* Strand 2 (3' <- 5' | rendered left-to-right reversed) */}
        <div className="flex items-center gap-1">
          <span className="w-8 text-right font-mono text-[10px] text-purple-400 font-bold pr-1">3'</span>
          {Array.from({ length: maxLength }).map((_, i) => {
            const base = s2Reversed[i] || '';
            return (
              <div
                key={`s2-${i}`}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white transition-all shadow-sm"
                style={{
                  backgroundColor: base ? (BASE_COLORS[base] || '#555') : 'transparent',
                  border: base ? 'none' : '1px dashed #334155'
                }}
              >
                {base || '-'}
              </div>
            );
          })}
          <span className="w-8 text-left font-mono text-[10px] text-purple-400 font-bold pl-1">5'</span>
          <span className="text-[9px] text-slate-500 ml-2 font-mono">({s2.length} nt)</span>
        </div>
      </div>

      {/* Stats legend */}
      <div className="flex justify-between mt-3 text-[10px] text-slate-500 border-t border-slate-900 pt-2">
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span>Watson-Crick Match</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 border-l border-dashed border-rose-500" />
            <span>Mismatch</span>
          </div>
        </div>
        <div className="font-mono">
          Alignment length: {maxLength} bp
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SequenceInput({ onPredictionComplete }: SequenceInputProps) {
  // Preset default matches the user's specific 5GNJ complex exactly
  const [proteinSeq, setProteinSeq] = useState(
    'MGREEPLNHVEAERQRREKLNQRFYALRAVVPNVSKMDKASLLGDAIAYINELKSKVVKTESEKLQIKNQLEEVKLELAGRLEHHHHHH'
  );
  const [dnaStrand1, setDnaStrand1] = useState('AGGAACACGTGACCC');
  const [dnaStrand2, setDnaStrand2] = useState('TGGGTCACGTGTTCC');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nimReady, setNimReady] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<string>('');

  // Check NIM status on mount
  useEffect(() => {
    checkNimStatus().then(s => setNimReady(s.configured)).catch(() => setNimReady(false));
  }, []);

  const handlePredict = async () => {
    if (!proteinSeq || !dnaStrand1 || !dnaStrand2) return;
    setLoading(true);
    setError(null);
    setProgress('Submitting complex to NVIDIA NIM OpenFold 3...');

    // Exact input format expected by openfold 3
    const molecules: MoleculeInput[] = [
      {
        type: 'protein',
        id: 'A',
        sequence: proteinSeq.trim(),
      },
      {
        type: 'dna',
        id: 'B',
        sequence: dnaStrand1.trim(),
      },
      {
        type: 'dna',
        id: 'C',
        sequence: dnaStrand2.trim(),
      }
    ];

    try {
      const timer1 = setTimeout(() => setProgress('NIM is running structure prediction (1-3 mins)...'), 5000);
      const timer2 = setTimeout(() => setProgress('Still running... OpenFold 3 is folding the complex...'), 60000);
      const timer3 = setTimeout(() => setProgress('Refining structures and scoring interfaces...'), 120000);

      const result = await predictStructure(molecules);

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      setProgress('');
      onPredictionComplete(result);
    } catch (err: any) {
      setError(err.message || 'Prediction failed');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = proteinSeq.length >= 10 && dnaStrand1.length >= 5 && dnaStrand2.length >= 5;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            NVIDIA NIM OpenFold 3
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Predict protein-DNA complex structure & interactions
          </p>
        </div>
        {nimReady !== null && (
          <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${
            nimReady
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${nimReady ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {nimReady ? 'API Ready' : 'API Key Missing'}
          </div>
        )}
      </div>

      {/* Input Fields */}
      <div className="flex flex-col gap-4">
        {/* Protein Input */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <label className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
            Protein Sequence (Chain A)
          </label>
          <textarea
            value={proteinSeq}
            onChange={e => setProteinSeq(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
            placeholder="Type or paste amino acid sequence..."
            rows={3}
            className="w-full bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-lg text-xs text-slate-200 px-3 py-2 outline-none font-mono resize-none transition"
            id="protein-seq-input"
          />
          <div className="text-[10px] text-slate-500 mt-1">
            Length: {proteinSeq.length} aa
          </div>
        </div>

        {/* DNA Strand 1 Input */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <label className="text-[11px] font-bold text-green-400 uppercase tracking-wider block mb-1">
            DNA Strand 1 (Chain B - 5' to 3')
          </label>
          <input
            type="text"
            value={dnaStrand1}
            onChange={e => setDnaStrand1(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
            placeholder="Type or paste nucleotide sequence (e.g. AGGAAC...)"
            className="w-full bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-lg text-xs text-slate-200 px-3 py-2 outline-none font-mono transition"
            id="dna-strand-1-input"
          />
        </div>

        {/* DNA Strand 2 Input */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <label className="text-[11px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
            DNA Strand 2 (Chain C - 5' to 3')
          </label>
          <input
            type="text"
            value={dnaStrand2}
            onChange={e => setDnaStrand2(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
            placeholder="Type or paste complementary nucleotide sequence..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-lg text-xs text-slate-200 px-3 py-2 outline-none font-mono transition"
            id="dna-strand-2-input"
          />
        </div>
      </div>

      {/* DNA strands visualization before generation */}
      {(dnaStrand1 || dnaStrand2) && (
        <AntiparallelDnaPreview strand1={dnaStrand1} strand2={dnaStrand2} />
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handlePredict}
        disabled={loading || !isFormValid || !nimReady}
        className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
          loading
            ? 'bg-purple-900/50 text-purple-300 cursor-wait'
            : isFormValid && nimReady
              ? 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
        id="predict-btn"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {progress || 'Generating...'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate 3D Structure
          </>
        )}
      </button>

      {/* Info footer */}
      <p className="text-[10px] text-slate-600 text-center">
        Prediction requires a valid NVIDIA API Key configured in your backend environment.
      </p>
    </div>
  );
}
