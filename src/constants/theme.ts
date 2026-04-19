/**
 * Centralized Animation Configuration
 * Focus: Tight, controlled, iOS-like tactile feedback.
 */
export const ANIMATION = {
  // Press scale for cards and items
  PRESS_SCALE: 0.97,
  
  // Opacity feedback for list items
  PRESS_OPACITY: 0.94,
  
  // Spring configuration for tactile response
  PRESS_SPRING: {
    stiffness: 260,
    damping: 25,
    mass: 0.6,
  },
  
  // Fade duration for screens and sequences
  FADE_DURATION: 200,
  
  // Staggering for lists
  STAGGER_DELAY: 50,
  STAGGER_MAX_INDEX: 6, // Don't animate below the fold
  STAGGER_MAX_DELAY: 200,
  
  // Reaction pulser
  REACTION_SCALE: 1.2,
  
  // FAB mount animation
  FAB_MOUNT_SCALE: 0.9,
  FAB_PRESS_SCALE: 0.95,
};
