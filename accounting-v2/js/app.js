import { DataService } from './data-service.js';
import { UIController } from './ui-controller.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("JGB Accounting V2 Initializing...");

    // Initialize standard Web-UI logic
    UIController.init();

    // Initialize Firestore data streaming
    DataService.init();
});
