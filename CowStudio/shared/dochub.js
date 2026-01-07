export class DocHub {
  constructor() {
    this.components = new Map();
  }
  parse(content) {
    const doc = {
      title: 'Unknown',
      components: [],
      raw: content
    };
    const titleMatch = content.match(/# (.*)/);
    if (titleMatch) doc.title = titleMatch[1];
    return doc;
  }
  registerComponent(name, component) {
    this.components.set(name, component);
  }
  renderComponent(name, props) {
    try {
      return this.components.get(name)(props);
    } catch (err) {
      throw new Error(`Component ${name} not found or render failed: ${err.message}`);
    }
  }
}
export const dochub = new DocHub();
