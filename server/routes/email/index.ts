import { Router } from 'express';
import { contactRoutes } from './contactRoutes';
import { contactListRoutes } from './contactListRoutes';
import { contactTagRoutes } from './contactTagRoutes';
import { bounceRoutes } from './bounceRoutes';
import { birthdayRoutes } from './birthdayRoutes';
import { emailDesignRoutes } from './emailDesignRoutes';
import { emailScheduleRoutes } from './emailScheduleRoutes';

// Re-export utilities that external files depend on
export { sanitizeEmailHtml, renderBirthdayTemplate } from './emailUtils';

// Combine all sub-routers into a single router
export const emailManagementRoutes = Router();

emailManagementRoutes.use(contactRoutes);
emailManagementRoutes.use(contactListRoutes);
emailManagementRoutes.use(contactTagRoutes);
emailManagementRoutes.use(bounceRoutes);
emailManagementRoutes.use(birthdayRoutes);
emailManagementRoutes.use(emailDesignRoutes);
emailManagementRoutes.use(emailScheduleRoutes);
