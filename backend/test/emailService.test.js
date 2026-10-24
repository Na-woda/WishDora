const assert = require('node:assert/strict');
const test = require('node:test');
const { buildEmailHTML } = require('../services/emailService');

test('wish email renders user content as escaped plain text', () => {
  const html = buildEmailHTML({
    greeting: '<svg onload="alert(1)">Hello & "friend"</svg>',
    receiverName: `<img src=x onerror='alert(2)'> "Friend"`,
    message: `<a href="javascript:alert(3)">click</a>\nCafé & 生日 🎉\r\n<img src=x onerror="alert(4)">`,
    senderName: `O'Connor "Best & Co"`,
    cardImage: 'https://res.cloudinary.com/wishdora/image/upload/card.jpg?x=1&y=2" onerror="alert(5)',
  });

  assert.match(html, /<title>&lt;svg onload=&quot;alert\(1\)&quot;&gt;Hello &amp; &quot;friend&quot;&lt;\/svg&gt;<\/title>/);
  assert.match(html, /Dear &lt;img src=x onerror=&#39;alert\(2\)&#39;&gt; &quot;Friend&quot;,/);
  assert.match(html, /&lt;a href=&quot;javascript:alert\(3\)&quot;&gt;click&lt;\/a&gt;<br>Café &amp; 生日 🎉<br>&lt;img src=x onerror=&quot;alert\(4\)&quot;&gt;/);
  assert.match(html, /O&#39;Connor &quot;Best &amp; Co&quot;/);
  assert.match(html, /<img src="https:\/\/res\.cloudinary\.com\/wishdora\/image\/upload\/card\.jpg\?x=1&amp;y=2&quot; onerror=&quot;alert\(5\)" alt="Greeting Card"/);
  assert.doesNotMatch(html, /<svg\b|<a href="javascript:|<img src=x\b|<img src="[^"]*" onerror=/i);
});

test('wish email preserves normal formatting and Unicode text', () => {
  const html = buildEmailHTML({
    greeting: 'Happy Birthday',
    receiverName: 'Ari',
    message: 'Visit https://example.test/?a=1&b=2\nCafé & cake 🎂',
    senderName: 'Sam',
  });

  assert.match(html, /<table width="100%"/);
  assert.match(html, /<title>Happy Birthday<\/title>/);
  assert.match(html, /Visit https:\/\/example\.test\/\?a=1&amp;b=2<br>Café &amp; cake 🎂/);
  assert.doesNotMatch(html, /<a\b/i);
});
