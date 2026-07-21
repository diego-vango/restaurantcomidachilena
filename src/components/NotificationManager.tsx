/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCircle2, Info, MessageSquare, ShieldAlert, X } from 'lucide-react';
import { NotificationMessage } from '../types';

interface NotificationProps {
  notifications: NotificationMessage[];
  onDismiss: (id: string) => void;
}

// Function to synthesize a clean "push notification" sound using Web Audio API (cross-browser, no external audio file required)
export const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Double bell chime (high-pitched, friendly)
    const playTone = (time: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + duration);
    };

    const now = ctx.currentTime;
    playTone(now, 587.33, 0.4); // D5
    playTone(now + 0.12, 880, 0.5); // A5
  } catch (err) {
    console.warn('Audio synthesis not allowed or supported by browser/iframe policy yet:', err);
  }
};

// Request native browser push permissions
export const requestNativeNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.warn('Iframe policy blocked standard Notification.requestPermission() popup. Gracefully using rich in-app banners.');
      return false;
    }
  }

  return false;
};

// Fire a native browser push notification
export const sendNativePushNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=128',
      });
    } catch (err) {
      console.warn('Native notification instantiation failed due to sandboxing, falling back to fully styled in-app popup.', err);
    }
  }
};

export default function NotificationManager({ notifications, onDismiss }: NotificationProps) {
  // Automatically clear notification after 6 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[notifications.length - 1];
      const timer = setTimeout(() => {
        onDismiss(latest.id);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notifications, onDismiss]);

  const getIcon = (type: NotificationMessage['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-teal-600" />;
      case 'warning':
        return <ShieldAlert className="w-5 h-5 text-rose-500" />;
      case 'status':
        return <Bell className="w-5 h-5 text-amber-500" />;
      default:
        return <Info className="w-5 h-5 text-teal-500" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none px-4 sm:px-0" id="push-notification-area">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto flex items-start gap-3 p-4 bg-white/95 backdrop-blur-md border border-slate-100 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 w-full"
            layoutId={notif.id}
          >
            <div className="p-2 bg-slate-50 rounded-lg flex-shrink-0">
              {getIcon(notif.type)}
            </div>
            
            <div className="flex-grow min-w-0 pr-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-900 text-sm truncate">
                  {notif.title}
                </h4>
                <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                  Hace un momento
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {notif.body}
              </p>
              {notif.type === 'status' && (
                <div className="mt-2 text-[10px] font-bold text-teal-600 tracking-wider uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />
                  Notificación de Pedido
                </div>
              )}
            </div>

            <button
              onClick={() => onDismiss(notif.id)}
              className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
