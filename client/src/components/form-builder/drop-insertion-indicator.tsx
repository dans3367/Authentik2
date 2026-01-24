import { useDroppable } from '@dnd-kit/core';

interface DropInsertionIndicatorProps {
  id: string;
  position: 'top' | 'bottom';
  elementId: string;
  isVisible: boolean;
}

export function DropInsertionIndicator({ id, position, elementId, isVisible }: DropInsertionIndicatorProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      elementId,
      position,
      isInsertionPoint: true,
    },
  });

  if (!isVisible) return null;

  return (
    <div
      ref={setNodeRef}
      className={`relative transition-all duration-200 ${
        isOver ? 'z-50 h-16' : 'z-10 h-8'
      }`}
      style={{ margin: position === 'top' ? '-12px 0 -12px 0' : '-12px 0 -12px 0' }}
    >
      {/* Large invisible hit area */}
      <div className="absolute inset-0" />
      
      {/* Visual indicator line */}
      <div
        className={`absolute left-0 right-0 h-1 rounded-full transition-all duration-200 ${
          isOver 
            ? 'bg-blue-500 shadow-lg shadow-blue-500/50 scale-y-100 opacity-100' 
            : 'bg-blue-300/40 scale-y-50 opacity-0 group-hover:opacity-60'
        }`}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      
      {/* Animated pulse effect when hovering */}
      {isOver && (
        <>
          <div 
            className="absolute left-0 right-0 h-1 bg-blue-400/50 rounded-full animate-pulse"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}