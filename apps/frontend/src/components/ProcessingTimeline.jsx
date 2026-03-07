const STEPS = [
  { key: 'UPLOADED', label: 'Queued' },
  { key: 'PROCESSING', label: 'Processing' },
  { key: 'COMPLETED', label: 'Done' },
];

function getStepIndex(status) {
  if (status === 'UPLOADING' || status === 'UPLOADED') return 0;
  if (status === 'PROCESSING') return 1;
  if (status === 'COMPLETED') return 2;
  return -1;
}

export default function ProcessingTimeline({ status }) {
  const currentIndex = getStepIndex(status);

  return (
    <div className="animate-fade-in rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Current status
      </h3>
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const isActive = i === currentIndex;
          const isPast = i < currentIndex;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={`h-0.5 flex-1 transition-all duration-500 ${
                      isPast ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                    isActive
                      ? 'scale-110 bg-emerald-500 text-white ring-4 ring-emerald-500/30'
                      : isPast
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isPast ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 transition-all duration-500 ${
                      isPast ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
              <span
                className={`mt-2 text-center text-xs font-medium transition-colors ${
                  isActive ? 'text-emerald-600' : isPast ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
