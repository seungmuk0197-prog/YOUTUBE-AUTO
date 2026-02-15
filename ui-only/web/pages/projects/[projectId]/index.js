import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function ProjectIndexPage() {
  const router = useRouter();
  const { projectId } = router.query;

  useEffect(() => {
    if (projectId) {
      router.replace(`/projects/${projectId}/script`);
    }
  }, [projectId, router]);

  return null;
}
