import { useEffect } from 'react';
import { ChefHat } from 'lucide-react';
import { isNative } from './lib/exporters';
import { useStore } from './store';
import { DialogHost, handleBack, Toast } from './ui/components';
import { Editor, leaveEditor } from './ui/Editor';
import { Home } from './ui/Home';

export function App() {
  const ready = useStore((s) => s.ready);
  const lang = useStore((s) => s.lang);
  const hasProject = useStore((s) => !!s.project);
  const init = useStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  // Android hardware back: close the top sheet, then leave the editor, then leave the app
  useEffect(() => {
    if (!isNative()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    void import('@capacitor/app').then(({ App: CapApp }) => {
      void CapApp.addListener('backButton', () => {
        if (handleBack()) return;
        if (useStore.getState().project) void leaveEditor();
        else void CapApp.exitApp();
      }).then((h) => {
        if (cancelled) void h.remove();
        else remove = () => void h.remove();
      });
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  if (!ready) {
    return (
      <div className="app" style={{ alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff', gap: 10 }}>
        <ChefHat size={54} />
        <b style={{ fontSize: 20 }}>Kitchen Studio</b>
      </div>
    );
  }
  return (
    <div className="app" key={lang}>
      {hasProject ? <Editor /> : <Home />}
      <DialogHost />
      <Toast />
    </div>
  );
}
