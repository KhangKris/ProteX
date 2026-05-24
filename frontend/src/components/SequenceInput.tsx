import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { MoleculeInput, predictStructure, checkNimStatus, PredictResponse } from '../utils/api';

// Base colors for nucleotide visualization
const BASE_COLORS: Record<string, string> = {
  A: '#ef4444', T: '#3b82f6', C: '#10b981', G: '#f59e0b',
  U: '#a855f7',
};

const COMPLEMENTS: Record<string, string> = {
  A: 'T', T: 'A', C: 'G', G: 'C',
  a: 't', t: 'a', c: 'g', g: 'c'
};

interface SequenceInputProps {
  onPredictionComplete: (result: PredictResponse) => void;
}

// DNA antiparallel strand hybridization display preview
function AntiparallelDnaPreview({ strand1, strand2 }: { strand1: string; strand2: string }) {
  const s1 = strand1.toUpperCase().replace(/[^ATCGU]/g, '');
  const s2 = strand2.toUpperCase().replace(/[^ATCGU]/g, '');

  if (!s1 && !s2) return null;

  const s2Reversed = s2.split('').reverse().join('');
  const maxLength = Math.max(s1.length, s2Reversed.length);

  return (
    <div className="mt-4 p-4 bg-slate-950 border border-slate-900 rounded-lg shadow-inner font-mono">
      <div className="text-[10px] font-bold text-slate-500 mb-3 flex items-center justify-between uppercase tracking-wider">
        <span>[DNA_HYBRIDIZATION_PREVIEW]</span>
        <span className="text-[9px] text-slate-600 font-normal">Antiparallel Channel</span>
      </div>

      <div className="flex flex-col gap-1 min-w-max pb-2">
        {/* Strand 1 (5' -> 3') */}
        <div className="flex items-center gap-1">
          <span className="w-8 text-right text-[10px] text-cyan-400 font-bold pr-1.5">5'</span>
          {Array.from({ length: maxLength }).map((_, i) => {
            const base = s1[i] || '';
            return (
              <div
                key={`s1-${i}`}
                className="w-5.5 h-5.5 rounded border flex items-center justify-center text-[9px] font-bold text-white transition-all shadow-sm"
                style={{
                  backgroundColor: base ? `${BASE_COLORS[base]}22` : 'transparent',
                  borderColor: base ? BASE_COLORS[base] : '#1e293b',
                  color: base ? BASE_COLORS[base] : '#475569'
                }}
              >
                {base || '-'}
              </div>
            );
          })}
          <span className="w-8 text-left text-[10px] text-cyan-400 font-bold pl-1.5">3'</span>
          <span className="text-[8px] text-slate-500 ml-2 font-mono">({s1.length} nt)</span>
        </div>

        {/* Watson-Crick Pairing Lines */}
        <div className="flex items-center gap-1 h-4">
          <span className="w-8" />
          {Array.from({ length: maxLength }).map((_, i) => {
            const base1 = s1[i] || '';
            const base2 = s2Reversed[i] || '';
            
            let lineType = 'none';
            if (base1 && base2) {
              lineType = COMPLEMENTS[base1] === base2 ? 'match' : 'mismatch';
            }

            return (
              <div key={`line-${i}`} className="w-5.5 flex justify-center items-center">
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

        {/* Strand 2 (3' <- 5') */}
        <div className="flex items-center gap-1">
          <span className="w-8 text-right text-[10px] text-purple-400 font-bold pr-1.5">3'</span>
          {Array.from({ length: maxLength }).map((_, i) => {
            const base = s2Reversed[i] || '';
            return (
              <div
                key={`s2-${i}`}
                className="w-5.5 h-5.5 rounded border flex items-center justify-center text-[9px] font-bold text-white transition-all shadow-sm"
                style={{
                  backgroundColor: base ? `${BASE_COLORS[base]}22` : 'transparent',
                  borderColor: base ? BASE_COLORS[base] : '#1e293b',
                  color: base ? BASE_COLORS[base] : '#475569'
                }}
              >
                {base || '-'}
              </div>
            );
          })}
          <span className="w-8 text-left text-[10px] text-purple-400 font-bold pl-1.5">5'</span>
          <span className="text-[8px] text-slate-500 ml-2 font-mono">({s2.length} nt)</span>
        </div>
      </div>

      {/* Legend details */}
      <div className="flex justify-between mt-3 text-[9px] text-slate-550 border-t border-slate-900/60 pt-2 uppercase">
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span>complement_pair</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 border-l border-dashed border-rose-500" />
            <span>mismatch_pair</span>
          </div>
        </div>
        <div>
          hybrid_len: {maxLength} bp
        </div>
      </div>
    </div>
  );
}

export default function SequenceInput({ onPredictionComplete }: SequenceInputProps) {
  const [proteinSeq, setProteinSeq] = useState(
    'MGREEPLNHVEAERQRREKLNQRFYALRAVVPNVSKMDKASLLGDAIAYINELKSKVVKTESEKLQIKNQLEEVKLELAGRLEHHHHHH'
  );
  const [dnaStrand1, setDnaStrand1] = useState('AGGAACACGTGACCC');
  const [dnaStrand2, setDnaStrand2] = useState('TGGGTCACGTGTTCC');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nimReady, setNimReady] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    checkNimStatus().then(s => setNimReady(s.configured)).catch(() => setNimReady(false));
  }, []);

  const handlePredict = async () => {
    if (!proteinSeq || !dnaStrand1 || !dnaStrand2) return;
    setLoading(true);
    setError(null);
    setProgress('CONNECTING_NVIDIA_NIM_FOLDING_CHANNELS...');

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
      const timer1 = setTimeout(() => setProgress('NIM_FOLDING_SEQUENCE_CHANNELS (1-3m)...'), 5000);
      const timer2 = setTimeout(() => setProgress('SOLVING_INTERFACE_CONTACTS...'), 60000);
      const timer3 = setTimeout(() => setProgress('CALCULATING_MINIMIZED_ENERGIES...'), 120000);

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
    <div className="flex flex-col gap-4 font-mono">
      {/* Header telemetry info */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-3">
        <div>
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
            <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
            NVIDIA NIM FOLD3
          </h3>
          <p className="text-[9px] text-slate-500 uppercase mt-0.5">
            de-novo multimeric folding engine
          </p>
        </div>
        {nimReady !== null && (
          <div className={`flex items-center gap-1.5 text-[8px] px-2 py-0.5 rounded border uppercase ${
            nimReady
              ? 'text-emerald-400 bg-emerald-950/40 border-emerald-900/30'
              : 'text-red-400 bg-red-950/40 border-red-900/30'
          }`}>
            <div className={`w-1 h-1 rounded-full ${nimReady ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {nimReady ? 'api_ready' : 'key_missing'}
          </div>
        )}
      </div>

      {/* Input Blocks */}
      <div className="flex flex-col gap-4">
        {/* Protein Area */}
        <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-3">
          <label className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest block mb-1.5">
            [CH_01] protein_seq (chain_a)
          </label>
          <textarea
            value={proteinSeq}
            onChange={e => setProteinSeq(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
            placeholder="input amino acid residues..."
            rows={3}
            className="w-full bg-slate-950 border border-slate-900 focus:border-slate-850 rounded-md text-xs text-slate-300 px-3 py-2 outline-none font-mono resize-none transition uppercase placeholder:text-slate-700"
            id="protein-seq-input"
          />
          <div className="text-[8px] text-slate-600 mt-1 uppercase">
            residues: {proteinSeq.length} aa
          </div>
        </div>

        {/* DNA 1 Area */}
        <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-3">
          <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-1.5">
            {"[CH_02] dna_seq_strand1 (chain_b - 5'→3')"}
          </label>
          <input
            type="text"
            value={dnaStrand1}
            onChange={e => setDnaStrand1(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
            placeholder="input nucleotides (a,t,c,g,u)..."
            className="w-full bg-slate-950 border border-slate-900 focus:border-slate-850 rounded-md text-xs text-slate-300 px-3 py-2 outline-none font-mono transition uppercase placeholder:text-slate-700"
            id="dna-strand-1-input"
          />
        </div>

        {/* DNA 2 Area */}
        <div className="bg-slate-950/50 border border-slate-900 rounded-lg p-3">
          <label className="text-[9px] font-bold text-purple-400 uppercase tracking-widest block mb-1.5">
            {"[CH_03] dna_seq_strand2 (chain_c - 5'→3')"}
          </label>
          <input
            type="text"
            value={dnaStrand2}
            onChange={e => setDnaStrand2(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
            placeholder="input complementary nucleotides..."
            className="w-full bg-slate-950 border border-slate-900 focus:border-slate-850 rounded-md text-xs text-slate-300 px-3 py-2 outline-none font-mono transition uppercase placeholder:text-slate-700"
            id="dna-strand-2-input"
          />
        </div>
      </div>

      {/* strands preview */}
      {(dnaStrand1 || dnaStrand2) && (
        <AntiparallelDnaPreview strand1={dnaStrand1} strand2={dnaStrand2} />
      )}

      {/* Error readouts */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-950/20 border border-red-900/35 rounded-lg text-xs text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="uppercase text-[9px]">[FAIL]: {error}</span>
        </div>
      )}

      {/* Fold Button */}
      <button
        onClick={handlePredict}
        disabled={loading || !isFormValid || !nimReady}
        className={`w-full py-3 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all border ${
          loading
            ? 'bg-purple-950/20 border-purple-900/30 text-purple-400 cursor-wait'
            : isFormValid && nimReady
              ? 'bg-purple-950 hover:bg-purple-900/90 text-purple-300 border-purple-800 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
              : 'bg-slate-950/50 text-slate-600 border-slate-900 cursor-not-allowed'
        }`}
        id="predict-btn"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progress}
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            [FOLD_MACROMOLECULAR_COMPLEX]
          </>
        )}
      </button>

      {/* Footer disclaimer */}
      <p className="text-[8px] text-slate-650 text-center uppercase tracking-wider">
        requires nim_openfold3_api_key in background runtime env
      </p>
    </div>
  );
}
