import "./globals.css";

export const metadata = {
  title: "Aludariu rezervacijos sistema",
  description: "Aludariu (brewery) reservation and booking calendar.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="lt">
      <body>{children}</body>
    </html>
  );
}
