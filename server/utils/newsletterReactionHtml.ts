/**
 * Newsletter Reaction HTML Builder
 * 
 * Re-exports from the shared module to maintain backward compatibility.
 * @see shared/newsletterReactionHtml.ts for the canonical implementation.
 */

export {
    generateReactionToken,
    buildReactionButtonsHtml,
    REACTION_TYPES,
    REACTIONS,
    type ReactionType,
} from '@shared/newsletterReactionHtml';
