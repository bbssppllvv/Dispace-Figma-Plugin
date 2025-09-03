/// <reference lib="webworker" />

// Minimal worker for thumbnail rendering using OffscreenCanvas when available

type RenderTask = {
  id: string;
  bytes: Uint8Array; // PNG/IMG bytes for preview snapshot (already rendered by engine)
  size: number; // output max side
  cropFactor: number;
};

type RenderResponse = {
  id: string;
  dataUrl: string;
};

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data as RenderTask;
  try {
    const blob = new Blob([msg.bytes], { type: 'image/png' });

    // Prefer createImageBitmap for speed
    let bmp: ImageBitmap | null = null;
    try { bmp = await createImageBitmap(blob); } catch { bmp = null; }

    const canvas: OffscreenCanvas = new OffscreenCanvas(msg.size, msg.size);
    const g = canvas.getContext('2d', { alpha: true })!;
    const crop = msg.cropFactor || 4.0;

    let srcW: number, srcH: number;
    if (bmp) { srcW = bmp.width; srcH = bmp.height; } else {
      const imgEl = await blobToImage(blob);
      srcW = imgEl.width; srcH = imgEl.height;
      // Draw directly
      const cw = srcW / crop, ch = srcH / crop;
      const sx = Math.max(0, (srcW - cw) / 2);
      const sy = Math.max(0, (srcH - ch) / 2);
      g.imageSmoothingEnabled = true;
      // @ts-ignore
      if (g.imageSmoothingQuality) (g as any).imageSmoothingQuality = 'high';
      g.drawImage(imgEl, sx, sy, cw, ch, 0, 0, msg.size, msg.size);
      const dataUrl = await canvasToDataUrl(canvas);
      ctx.postMessage({ id: msg.id, dataUrl } as RenderResponse);
      return;
    }

    const cw = (bmp as ImageBitmap).width / crop; const ch = (bmp as ImageBitmap).height / crop;
    const sx = Math.max(0, ((bmp as ImageBitmap).width - cw) / 2);
    const sy = Math.max(0, ((bmp as ImageBitmap).height - ch) / 2);
    g.imageSmoothingEnabled = true;
    // @ts-ignore
    if (g.imageSmoothingQuality) (g as any).imageSmoothingQuality = 'high';
    g.drawImage(bmp as ImageBitmap, sx, sy, cw, ch, 0, 0, msg.size, msg.size);
    const dataUrl = await canvasToDataUrl(canvas);
    ctx.postMessage({ id: msg.id, dataUrl } as RenderResponse);
  } catch (_e) {
    ctx.postMessage({ id: (e.data as RenderTask).id, dataUrl: '' } as RenderResponse);
  }
};

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}

function canvasToDataUrl(canvas: OffscreenCanvas): Promise<string> {
  // convert to Blob then to dataURL
  return new Promise((resolve, reject) => {
    canvas.convertToBlob({ type: 'image/png' }).then((blob) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(new Error('read error'));
      fr.readAsDataURL(blob);
    }).catch(reject);
  });
}

export {};


