import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export const useShellNavigation = () => {
  const navigate = useNavigate();

  const open = useCallback(
    (route: string) => {
      navigate(route);
    },
    [navigate]
  );

  const goHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  return { open, goHome };
};

