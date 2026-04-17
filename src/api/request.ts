import axios, { type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth";
import router from "@/router";

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

request.interceptors.request.use((config) => {
  const authStore = useAuthStore();
  if (authStore.token) {
    config.headers.Authorization = `Bearer ${authStore.token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data.code !== 0) {
      const error = new Error(data.message || "请求失败") as Error & {
        code: number | string;
      };
      error.code = data.code;
      return Promise.reject(error);
    }
    return data.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      router.push("/login");
    }
    return Promise.reject(error);
  },
);

export function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return request.get(url, config) as Promise<T>;
}

export function post<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request.post(url, data, config) as Promise<T>;
}

export function put<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  return request.put(url, data, config) as Promise<T>;
}

export function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return request.delete(url, config) as Promise<T>;
}

export default request;
