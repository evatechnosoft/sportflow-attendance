# SportFlow

Okul bazlı spor kulübü yoklama uygulaması. v1 **mock veri** ile çalışır; ağ ve
backend bağımlılığı yoktur.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # vitest
npm run build
```

- Spec: `docs/spec.md`
- Yol haritası: `docs/plan.md`

## Mimari

```
src/domain      saf tipler, bağımlılıksız
src/ports       repository arayüzleri (UI yalnız bunları görür)
src/adapters    mock/ (v1) · api/ (faz 6)
src/app         DataSourceProvider — tek DI noktası
src/features    ekranlar
src/testing     adapter'ların geçmesi zorunlu contract test
```

Yeni bir veri kaynağı eklemek = `DataSource` arayüzünü uygulamak + contract testi
geçmek. UI'da tek satır değişmez.
