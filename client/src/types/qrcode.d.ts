declare module 'qrcode' {
  interface QRCodeStatic {
    toDataURL(text: string, options?: any): Promise<string>;
  }
  const QRCode: QRCodeStatic;
  export default QRCode;
}
