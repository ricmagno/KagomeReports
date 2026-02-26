import { useToastContext } from './ToastContext';

export const useToast = () => {
  return useToastContext();
};
