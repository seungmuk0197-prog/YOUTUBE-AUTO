import fs from 'fs';
import path from 'path';
import Head from 'next/head';
import Script from 'next/script';

function extractBetween(source, startTag, endTag) {
  const start = source.indexOf(startTag);
  if (start === -1) return '';
  const end = source.indexOf(endTag, start + startTag.length);
  if (end === -1) return '';
  return source.slice(start + startTag.length, end);
}

function extractAllStyles(headHtml) {
  const styles = [];
  const regex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = regex.exec(headHtml)) !== null) {
    styles.push(match[1]);
  }
  return styles;
}

function stripScripts(bodyHtml) {
  const scripts = [];
  const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let cleaned = bodyHtml;
  let match;
  while ((match = regex.exec(bodyHtml)) !== null) {
    scripts.push(match[1]);
  }
  cleaned = cleaned.replace(regex, '');
  return { cleaned, scripts };
}

export default function HtmlPage({ rawHtml }) {
  const headHtml = extractBetween(rawHtml, '<head>', '</head>');
  const bodyHtml = extractBetween(rawHtml, '<body>', '</body>');
  const titleMatch = headHtml.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : 'HANRA STUDIO';
  const styles = extractAllStyles(headHtml);
  const { cleaned, scripts } = stripScripts(bodyHtml);

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        {styles.map((css, idx) => (
          <style
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: css }}
            key={`html-style-${idx}`}
          />
        ))}
      </Head>
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: cleaned }}
      />
      {scripts.map((script, idx) => (
        <Script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: script }}
          id={`html-script-${idx}`}
          key={`html-script-${idx}`}
          strategy="afterInteractive"
        />
      ))}
    </>
  );
}

export async function getServerSideProps({ params }) {
  const slugParts = Array.isArray(params?.slug) ? params.slug : [];
  if (slugParts.length === 0) {
    return { notFound: true };
  }

  const requestPath = slugParts.join('/');
  const fileName = requestPath.endsWith('.html') ? requestPath : `${requestPath}.html`;
  const filePath = path.join(process.cwd(), 'pages', 'html', fileName);

  if (!fs.existsSync(filePath)) {
    return { notFound: true };
  }

  const rawHtml = fs.readFileSync(filePath, 'utf8');
  return { props: { rawHtml } };
}
