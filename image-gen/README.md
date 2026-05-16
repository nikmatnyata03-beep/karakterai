# 🎨 AI Image to Image Generator

Aplikasi web untuk mengubah gambar menggunakan AI dengan teknologi Stable Diffusion.

## ✨ Fitur

- **Drag & Drop Upload** - Upload gambar dengan mudah
- **Custom Prompt** - Deskripsikan hasil yang diinginkan
- **Negative Prompt** - Tentukan apa yang harus dihindari
- **Transformation Strength** - Kontrol seberapa banyak gambar diubah
- **Guidance Scale** - Atur kepatuhan terhadap prompt
- **Download Result** - Unduh hasil generate
- **Real-time Preview** - Lihat perbandingan sebelum dan sesudah

## 🚀 Cara Menggunakan

### 1. Dapatkan Hugging Face Token

1. Buat akun di [huggingface.co](https://huggingface.co)
2. Buka [Settings > Access Tokens](https://huggingface.co/settings/tokens)
3. Generate new token (tipe: Read)
4. Copy token Anda

### 2. Setup Environment Variable

Set environment variable di Vercel atau lokal:

```bash
HUGGINGFACE_TOKEN=your_token_here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Development Mode

```bash
npm run dev
```

### 5. Deploy ke Vercel

```bash
npm run deploy
```

Atau melalui Vercel Dashboard:
1. Push ke GitHub
2. Import project di [vercel.com/new](https://vercel.com/new)
3. Set environment variable `HUGGINGFACE_TOKEN`
4. Deploy!

## 📁 Struktur File

```
image-gen/
├── api/
│   └── generate.js          # API endpoint untuk generate image
├── public/
│   └── index.html           # Frontend aplikasi
├── package.json             # Dependencies
├── vercel.json              # Vercel configuration
└── README.md                # Dokumentasi
```

## ⚙️ Konfigurasi

### Parameter Generate

- **Prompt**: Deskripsi teks dari hasil yang diinginkan
- **Negative Prompt**: Elemen yang ingin dihindari
- **Strength** (0.1 - 1.0): 
  - Rendah = Hasil lebih mirip original
  - Tinggi = Lebih kreatif dan berbeda
- **Guidance Scale** (1 - 20):
  - Rendah = Lebih bebas interpretasi
  - Tinggi = Lebih patuh pada prompt

## 🔧 Environment Variables

| Variable | Keterangan | Required |
|----------|------------|----------|
| `HUGGINGFACE_TOKEN` | Token API dari Hugging Face | ✅ Ya |

## 💡 Tips Penggunaan

1. **Untuk hasil terbaik**: Gunakan prompt yang deskriptif dan detail
2. **Strength rendah** (0.3-0.5): Cocok untuk enhancement atau style transfer ringan
3. **Strength tinggi** (0.7-1.0): Untuk transformasi drastis
4. **Negative prompt**: Selalu sertakan "ugly, blurry, low quality" untuk hasil lebih baik

## 🛠️ Teknologi

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js (Vercel Serverless Functions)
- **AI Model**: Stable Diffusion 2.1 via Hugging Face Inference API
- **Hosting**: Vercel

## 📝 Contoh Prompt

```
Positive: "a cyberpunk cityscape at night, neon lights, rain reflections, highly detailed, 8k"
Negative: "ugly, blurry, low quality, distorted, deformed"
Strength: 0.75
Guidance: 7.5
```

## ⚠️ Catatan

- Generate gambar memakan waktu 30-60 detik tergantung antrian API
- Model gratis Hugging Face memiliki rate limit
- Untuk penggunaan produksi, pertimbangkan upgrade ke Hugging Face Pro atau hosting model sendiri

## 📄 License

MIT License - bebas digunakan untuk proyek pribadi maupun komersial

---

Dibuat dengan ❤️ menggunakan Stable Diffusion dan Hugging Face
