import type { OpenQuestion } from "../../lib/forkDetection";
import { HelpIcon } from "../../lib/icons";

interface Props {
  questions: OpenQuestion[];
  onJump: (line: number) => void;
}

export default function OpenQuestions({ questions, onJump }: Props) {
  if (questions.length === 0) return null;
  return (
    <div className="border-t border-bd px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-2xs uppercase tracking-wider text-t3 font-semibold">
          Open questions
        </div>
        <span
          className="y-tip text-t3 inline-flex"
          data-tip="Lines that start with ?? in your note"
        >
          <HelpIcon />
        </span>
      </div>
      <ul className="space-y-1">
        {questions.map((q, i) => (
          <li key={`${q.line}-${i}`}>
            <button
              onClick={() => onJump(q.line)}
              className="w-full text-left flex gap-2 items-start p-2 rounded hover:bg-s2 text-xs transition"
            >
              <span className="shrink-0 mt-0.5 font-mono text-[10px] font-semibold text-yeld bg-yelp rounded px-1 py-0.5">
                ??
              </span>
              <span className="text-ch2 line-clamp-2 leading-snug">{q.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
