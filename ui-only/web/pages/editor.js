import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Legacy editor redirect — routes /editor?id=xxx to /projects/xxx/script
 */
export default function EditorRedirect() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (id) {
      router.replace(`/projects/${id}/script`);
    } else if (router.isReady) {
      router.replace('/');
    }
  }, [id, router.isReady]);

  return null;
}
