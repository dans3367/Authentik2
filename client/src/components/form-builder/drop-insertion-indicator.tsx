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
      className={`relative transition-all duration-150 ${
        isOver ? 'z-50 h-6' : 'z-10 h-3'
      }`}
    >
      {/* Visual indicator line - only prominent when hovered */}
      <div
        className={`absolute left-0 right-0 h-0.5 rounded-full transition-all duration-150 ${
          isOver 
            ? 'bg-amber-500 shadow-md shadow-amber-500/40 h-1 opacity-100' 
            : 'bg-transparent opacity-0'
        }`}
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      />
      
      {/* Plus icon when hovering */}
      {isOver && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </div>
  );
}