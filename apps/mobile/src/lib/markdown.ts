import { Lexer, type Token, type Tokens } from 'marked';
export type Inline = { kind: 'text' | 'strong' | 'em' | 'del' | 'code' | 'link'; text?: string; href?: string; children?: Inline[] };
export type Block = { kind: 'paragraph' | 'heading' | 'quote' | 'code' | 'rule' | 'list' | 'table'; content?: Inline[]; depth?: number; text?: string; blocks?: Block[]; ordered?: boolean; start?: number; items?: Block[][]; header?: Inline[][]; rows?: Inline[][][] };
export function safeChatLink(href: string) {
  // Conversational prose cannot supply navigation destinations. Verified product
  // cards and checkout buttons carry the server-validated shopping links.
  try { const url = new URL(href); return url.protocol === 'https:' && ['arviva.space', 'www.arviva.space'].includes(url.hostname) && !url.username && !url.password && !url.port && ['/privacy', '/terms'].includes(url.pathname) && !url.search ? url.toString() : undefined; }
  catch { return undefined; }
}
function inline(tokens: Token[]): Inline[] {
  return tokens.flatMap((token): Inline[] => {
    switch (token.type) {
      case 'strong': case 'em': case 'del': return [{ kind: token.type, children: inline((token as Tokens.Strong).tokens) }];
      case 'codespan': return [{ kind: 'code', text: (token as Tokens.Codespan).text }];
      case 'br': return [{ kind: 'text', text: '\n' }];
      case 'link': { const link = token as Tokens.Link; return [{ kind: 'link', href: safeChatLink(link.href), children: inline(link.tokens) }]; }
      // Product images are supplied only by verified cards. Markdown never loads
      // model-supplied images, runs HTML, or opens custom URL schemes.
      case 'image': return [{ kind: 'text', text: (token as Tokens.Image).text }];
      default: {
        const text = token as Tokens.Text;
        return text.tokens ? inline(text.tokens) : [{ kind: 'text', text: text.text || token.raw }];
      }
    }
  });
}
function blocks(tokens: Token[]): Block[] {
  return tokens.flatMap((token): Block[] => {
    switch (token.type) {
      case 'space': return [];
      case 'heading': { const heading = token as Tokens.Heading; return [{ kind: 'heading', depth: heading.depth, content: inline(heading.tokens) }]; }
      case 'paragraph': case 'text': {
        const paragraph = token as Tokens.Paragraph;
        return [{ kind: 'paragraph', content: paragraph.tokens ? inline(paragraph.tokens) : [{ kind: 'text', text: paragraph.text }] }];
      }
      case 'list': { const list = token as Tokens.List; return [{ kind: 'list', ordered: list.ordered, start: list.start || 1, items: list.items.map(item => blocks(item.tokens)) }]; }
      case 'blockquote': return [{ kind: 'quote', blocks: blocks((token as Tokens.Blockquote).tokens) }];
      case 'code': return [{ kind: 'code', text: (token as Tokens.Code).text }];
      case 'hr': return [{ kind: 'rule' }];
      case 'table': { const table = token as Tokens.Table; return [{ kind: 'table', header: table.header.map(cell => inline(cell.tokens)), rows: table.rows.map(row => row.map(cell => inline(cell.tokens))) }]; }
      default: return [{ kind: 'paragraph', content: [{ kind: 'text', text: token.raw }] }];
    }
  });
}
export function chatMarkdown(text: string): Block[] { return blocks(Lexer.lex(text, { gfm: true, breaks: true })); }
