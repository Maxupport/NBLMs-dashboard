export const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) {
    return r.json().then(data => {
      throw new Error(data.error || '請求失敗');
    });
  }
  return r.json();
});
