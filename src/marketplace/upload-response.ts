type UploadEnvelope<T> = { success: true; data: T; message?: string };
type UploadFailure = {
  success: false;
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
};

export async function uploadResponseResult<T>(response: Response) {
  const responseText = await response.text();
  let body: UploadEnvelope<T> | UploadFailure | undefined;
  try {
    body = JSON.parse(responseText) as UploadEnvelope<T> | UploadFailure;
  } catch {
    body = undefined;
  }

  if (!body) {
    return {
      error: {
        code: response.status === 413 ? "FILE_TOO_LARGE" : "UPLOAD_FAILED",
        message:
          response.status === 413
            ? "This image is too large to upload. Please choose a smaller image."
            : "The upload service returned an invalid response. Please try again.",
      },
    };
  }
  if (!response.ok || !body.success) {
    const error = body as UploadFailure;
    return {
      error: {
        code: error.error?.code ?? "UPLOAD_FAILED",
        message: error.error?.message ?? "The upload failed",
      },
    };
  }
  return { data: body.data };
}
