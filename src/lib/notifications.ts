import { writable } from "svelte/store";

export type Notification = {
    id: string;
    message: string;
    type: "success" | "error" | "info";
    duration?: number;
};

function createNotificationStore() {
    const { subscribe, set, update } = writable<Notification[]>([]);
    let idCounter = 0;

    return {
        subscribe,
        add: (message: string, type: Notification["type"] = "info", duration = 3000) => {
            const id = `notification-${Date.now()}-${idCounter++}`;
            const notification: Notification = { id, message, type, duration };
            
            update((notifications) => [...notifications, notification]);
            
            if (duration > 0) {
                setTimeout(() => {
                    update((notifications) => notifications.filter((n) => n.id !== id));
                }, duration);
            }
        },
        remove: (id: string) => {
            update((notifications) => notifications.filter((n) => n.id !== id));
        },
        success: (message: string, duration = 3000) => {
            const id = `notification-${Date.now()}-${idCounter++}`;
            const notification: Notification = { id, message, type: "success", duration };
            
            update((notifications) => [...notifications, notification]);
            
            if (duration > 0) {
                setTimeout(() => {
                    update((notifications) => notifications.filter((n) => n.id !== id));
                }, duration);
            }
        },
        error: (message: string, duration = 3000) => {
            const id = `notification-${Date.now()}-${idCounter++}`;
            const notification: Notification = { id, message, type: "error", duration };
            
            update((notifications) => [...notifications, notification]);
            
            if (duration > 0) {
                setTimeout(() => {
                    update((notifications) => notifications.filter((n) => n.id !== id));
                }, duration);
            }
        },
        info: (message: string, duration = 3000) => {
            const id = `notification-${Date.now()}-${idCounter++}`;
            const notification: Notification = { id, message, type: "info", duration };
            
            update((notifications) => [...notifications, notification]);
            
            if (duration > 0) {
                setTimeout(() => {
                    update((notifications) => notifications.filter((n) => n.id !== id));
                }, duration);
            }
        },
    };
}

export const notifications = createNotificationStore();

