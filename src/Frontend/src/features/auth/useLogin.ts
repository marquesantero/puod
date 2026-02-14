import { useMutation } from "@tanstack/react-query";
import { login } from "./api";
import type { LoginData, LoginResponse } from "./api";
import { useNavigate } from "react-router-dom";
import { getDatabaseBootstrap, getSetupStatus } from "@/lib/setupApi";

export const useLogin = () => {
  const navigate = useNavigate();

  return useMutation<LoginResponse, Error, LoginData>({
    mutationFn: login,
    onSuccess: async (data) => {
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      try {
        const setup = await getSetupStatus();
        if (!setup.isConfigured) {
          navigate("/setup");
          return;
        }
        try {
          const status = await getDatabaseBootstrap();
          if (!status.connectionStringMasked) {
            navigate("/setup");
            return;
          }
        } catch {
          // If setup is already configured, ignore bootstrap errors.
        }
      } catch {
        navigate("/setup");
        return;
      }
      navigate("/dashboard");
    },
    onError: (error) => {
      // Here you could show a toast notification
      console.error("Login failed:", error.message);
    },
  });
};
