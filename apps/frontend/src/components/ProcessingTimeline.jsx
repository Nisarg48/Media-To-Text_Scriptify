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
    <div className="animate-fade-in rounded-2xl border border-surface-border bg-surface/90 p-6 shadow-glass backdrop-blur-xl">
      <h3 className="mb-4 text-small font-semibold uppercase tracking-wide text-content-subtle">
        Current status
      </h3>
      <div className="flex items-start">
        {STEPS.map((step, i) => {
          const isPast = i < currentIndex;
          const isActive = i === currentIndex;
          const isProcessingStep = step.key === 'PROCESSING';
          const showInProgress = isActive && isProcessingStep;
          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                      isPast ? 'bg-accent' : 'bg-surface-muted'
                    }`}
                  />
                )}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                    isPast
                      ? 'bg-accent text-accent-foreground'
                      : isActive
                        ? 'bg-accent text-accent-foreground shadow-glow-sm ring-4 ring-accent/30'
                        : 'bg-surface-muted text-content-subtle'
                  } ${showInProgress ? 'animate-pulse' : ''}`}
                >
                  {isPast ? '✓' : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                      isPast ? 'bg-accent' : 'bg-surface-muted'
                    }`}
                  />
                )}
              </div>
              <span
                className={`mt-2 text-center text-xs font-medium transition-colors ${
                  isActive ? 'text-accent' : isPast ? 'text-content-muted' : 'text-content-subtle'
                }`}
              >
                {step.label}
                {showInProgress && (
                  <span className="ml-1 text-content-subtle">(in progress)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
