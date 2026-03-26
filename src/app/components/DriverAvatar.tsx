import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface DriverAvatarProps {
  path: string | null;
  name: string;
  className?: string;
}

export default function DriverAvatar({ path, name, className = "w-12 h-12" }: DriverAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    // Handle absolute URLs (e.g. from social auth)
    if (path.startsWith('http')) {
      setUrl(path);
      return;
    }

    let mounted = true;
    setUrl(null);
    supabase.storage.from('avatars').createSignedUrl(path, 3600).then(({ data }) => {
      if (mounted && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { mounted = false; };
  }, [path]);

  if (url) {
    return <img src={url} alt={name} className={`${className} rounded-full object-cover border border-gray-200 dark:border-gray-700`} />;
  }

  return (
    <div className={`${className} rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold shadow-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}