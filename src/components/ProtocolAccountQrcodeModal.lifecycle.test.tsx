// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchMeta: vi.fn(),
  fetchImage: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/api/protocol", () => ({
  protocolApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  protocolFetchQrcodeImageBlob: api.fetchImage,
  protocolFetchQrcodeMeta: api.fetchMeta,
  protocolRefreshAccountQrcode: api.refresh,
}));

import ProtocolAccountQrcodeModal from "@/components/ProtocolAccountQrcodeModal";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  api.fetchMeta.mockReset();
  api.fetchImage.mockReset().mockResolvedValue(new Blob(["qr"]));
  api.refresh.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("ignores a QR metadata response that arrives after the modal closes", async () => {
  const oldMeta = deferred<{ exists: boolean; updated_at: number }>();
  const nextMeta = deferred<{ exists: boolean; updated_at: number }>();
  api.fetchMeta.mockReturnValueOnce(oldMeta.promise).mockReturnValueOnce(nextMeta.promise);
  const props = {
    open: true,
    mountUrl: "http://protocol.test/protocol/console",
    accountId: "account-1",
    accountTitle: "测试账号",
    onClose: vi.fn(),
  };
  const view = render(<ProtocolAccountQrcodeModal {...props} />);
  await waitFor(() => expect(api.fetchMeta).toHaveBeenCalledTimes(1));

  view.rerender(<ProtocolAccountQrcodeModal {...props} open={false} />);
  await act(async () => {
    oldMeta.resolve({ exists: true, updated_at: 123 });
    await oldMeta.promise;
  });
  expect(api.fetchImage).not.toHaveBeenCalled();

  view.rerender(<ProtocolAccountQrcodeModal {...props} open accountId="account-2" />);
  await waitFor(() => expect(api.fetchMeta).toHaveBeenCalledTimes(2));
  expect(document.querySelector('img[alt="协议端登录二维码"]')).toBeNull();
});
