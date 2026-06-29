export async function requestCamera(constraints: MediaStreamConstraints, timeoutMs = 12000) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_UNAVAILABLE')
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const mediaRequest = navigator.mediaDevices.getUserMedia(constraints)
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true
      reject(new DOMException('Tempo de permissão esgotado.', 'TimeoutError'))
    }, timeoutMs)
  })
  try {
    return await Promise.race([mediaRequest, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    if (timedOut) void mediaRequest.then((stream) => stream.getTracks().forEach((track) => track.stop())).catch(() => undefined)
  }
}
