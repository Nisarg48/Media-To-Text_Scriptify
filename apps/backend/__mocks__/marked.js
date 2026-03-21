const marked = (src) => `<p>${src}</p>`;
marked.parse = marked;
marked.setOptions = () => {};
marked.use = () => {};
marked.Renderer = function () {};
module.exports = { marked };
