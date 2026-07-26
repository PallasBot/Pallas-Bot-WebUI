import type { AxiosRequestConfig } from "axios";
import type { paths as ConsoleOpenapiPaths } from "./generated/pallasConsoleOpenapi";
import { http } from "./http";

export type { ConsoleOpenapiPaths };

type OpenapiJson200<TOperation> = TOperation extends {
  responses: { 200: { content: { "application/json": infer TBody } } };
}
  ? TBody
  : never;

export type OpenapiOkData<TOperation> = OpenapiJson200<TOperation> extends { data: infer TData } ? TData : never;

interface ApiOkEnvelope<T> {
  ok: boolean;
  data: T;
}

function unwrapConsoleData<T>(body: ApiOkEnvelope<T> | null | undefined, path: string): T {
  if (!body || typeof body !== "object" || !("ok" in body) || !body.ok) {
    throw new Error(`${path}: 响应异常`);
  }
  return body.data;
}

export async function consoleOpenapiGet<TOperation>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<OpenapiOkData<TOperation>> {
  const { data } = await http.get<ApiOkEnvelope<OpenapiOkData<TOperation>>>(url, config);
  return unwrapConsoleData(data, url);
}

export async function consoleOpenapiPost<TOperation>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<OpenapiOkData<TOperation>> {
  const { data } = await http.post<ApiOkEnvelope<OpenapiOkData<TOperation>>>(url, body, config);
  return unwrapConsoleData(data, url);
}

export async function consoleOpenapiPut<TOperation>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<OpenapiOkData<TOperation>> {
  const { data } = await http.put<ApiOkEnvelope<OpenapiOkData<TOperation>>>(url, body, config);
  return unwrapConsoleData(data, url);
}

export async function consoleOpenapiPatch<TOperation>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<OpenapiOkData<TOperation>> {
  const { data } = await http.patch<ApiOkEnvelope<OpenapiOkData<TOperation>>>(url, body, config);
  return unwrapConsoleData(data, url);
}

export async function consoleOpenapiDelete<TOperation>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<OpenapiOkData<TOperation>> {
  const { data } = await http.delete<ApiOkEnvelope<OpenapiOkData<TOperation>>>(url, config);
  return unwrapConsoleData(data, url);
}
