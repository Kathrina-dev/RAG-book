/**
 * StreamingActivity.jsx
 *
 * Real-time RAG pipeline activity indicator.
 * Maps backend SSE event names to human-readable messages.
 * Never displays raw backend event names to users.
 */

import { CheckCircleIcon } from './icons';

// Ordered pipeline stages with user-facing messages
const PIPELINE_STAGES = [
  {
    event: 'started',
    message: 'Warming up the research desk…',
    done: 'Ready',
  },
  {
    event: 'embedding_started',
    message: 'Understanding your question…',
    done: 'Question understood',
  },
  {
    event: 'embedding_completed',
    message: 'Question encoded.',
    done: 'Question encoded',
    // This stage is usually immediate, so it may skip past
  },
  {
    event: 'similarity_started',
    message: 'Digging through your documents…',
    done: 'Documents searched',
  },
  {
    event: 'chunks_retrieved',
    message: 'Found some interesting passages.',
    done: 'Passages found',
  },
  {
    event: 'generation_started',
    message: 'Putting the pieces together…',
    done: 'Drafting answer',
  },
  {
    event: 'generation_completed',
    message: 'Polishing the response…',
    done: 'Response polished',
  },
  {
    event: 'answer_saved',
    message: 'Saving this conversation…',
    done: 'Conversation saved',
  },
  {
    event: 'done',
    message: 'Your answer is ready.',
    done: 'Complete',
  },
];

const EVENT_ORDER = PIPELINE_STAGES.map((s) => s.event);

function getStageIndex(event) {
  return EVENT_ORDER.indexOf(event);
}

export function useStreamingStages() {
  // Returns the initial state and a reducer-style updater
  return {
    initialStages: [],
    getUpdatedStages: (currentEvent) => {
      const idx = getStageIndex(currentEvent);
      if (idx === -1) return null;
      return PIPELINE_STAGES.slice(0, idx + 1);
    },
  };
}

// Single timeline step
function TimelineStep({ stage, status }) {
  // status: 'done' | 'active' | 'pending'
  return (
    <div className={`timeline-step ${status}`} role="listitem">
      <div className="timeline-step-icon">
        {status === 'done' ? (
          <CheckCircleIcon size={12} className="timeline-check" />
        ) : (
          <span className={`step-dot ${status === 'active' ? 'pulse' : ''}`} />
        )}
      </div>
      <span>
        {status === 'done' ? stage.done : stage.message}
      </span>
    </div>
  );
}

// Animated streaming dots
function StreamingDots() {
  return (
    <div className="streaming-dots" aria-hidden="true">
      <span className="streaming-dot" />
      <span className="streaming-dot" />
      <span className="streaming-dot" />
    </div>
  );
}

export default function StreamingActivity({ currentEvent, completedEvents, isDone }) {
  const currentIdx = getStageIndex(currentEvent);

  // Determine which stages to show:
  // show all completed + current + a couple pending
  const visibleStages = PIPELINE_STAGES.filter((stage, i) => {
    const isCompleted = completedEvents.includes(stage.event);
    const isCurrent = stage.event === currentEvent;
    const isNearFuture = i <= currentIdx + 2;
    return isCompleted || isCurrent || isNearFuture;
  });

  return (
    <div className="streaming-activity" role="status" aria-live="polite" aria-label="Research progress">
      <div className="streaming-indicator">
        {isDone ? (
          <CheckCircleIcon size={14} style={{ color: 'var(--success)' }} />
        ) : (
          <StreamingDots />
        )}
      </div>
      <div className="streaming-timeline" role="list" aria-label="Pipeline stages">
        {visibleStages.map((stage) => {
          const isCompleted = completedEvents.includes(stage.event);
          const isCurrent = !isCompleted && stage.event === currentEvent;
          const status = isCompleted ? 'done' : isCurrent ? 'active' : 'pending';
          return (
            <TimelineStep key={stage.event} stage={stage} status={status} />
          );
        })}
      </div>
    </div>
  );
}
