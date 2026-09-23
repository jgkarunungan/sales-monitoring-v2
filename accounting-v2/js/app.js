import { DataService } from './data-service.js';
import { UIController } from './ui-controller.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("[BOOT] App start");

    window.DataService = DataService;
    window.UIController = UIController;

    // Initialize standard Web-UI logic
    UIController.init();

    // Initialize Firestore data streaming
    DataService.init();
});
