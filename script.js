const API_URL = "https://dev.to/api/articles?page=1&per_page=20";
const ARTICLE_API_URL = "https://dev.to/api/articles";
const MAX_ARTICLES = 20;

const articlesContainer = document.querySelector("#articles-container");
const articleTemplate = document.querySelector("#article-template");
const initialLoader = document.querySelector("#initial-loader");
const scrollLoader = document.querySelector("#scroll-loader");
const scrollSentinel = document.querySelector("#scroll-sentinel");
const errorMessage = document.querySelector("#error-message");
const errorText = document.querySelector("#error-text");
const retryButton = document.querySelector("#retry-button");
const endMessage = document.querySelector("#end-message");

let articleList = [];
let nextArticleIndex = 0;
let isLoading = false;
let observer;
const loadedArticleIds = new Set();

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: no se pudo obtener la información.`);
  }

  return response.json();
}

function formatDate(dateValue) {
  const date = new Date(dateValue);

  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getCategory(article) {
  if (article.tags?.length) return article.tags[0];
  if (article.tag_list?.length) return article.tag_list[0];
  return "Tecnología";
}

function createShareUrls(article) {
  const articleUrl = encodeURIComponent(article.url);
  const text = encodeURIComponent(article.title);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${articleUrl}`,
    whatsapp: `https://wa.me/?text=${text}%20${articleUrl}`,
    x: `https://twitter.com/intent/tweet?text=${text}&url=${articleUrl}`,
  };
}

function setShareLinks(articleElement, article) {
  const shareUrls = createShareUrls(article);

  articleElement.querySelectorAll(".share-facebook").forEach((link) => {
    link.href = shareUrls.facebook;
  });
  articleElement.querySelectorAll(".share-whatsapp").forEach((link) => {
    link.href = shareUrls.whatsapp;
  });
  articleElement.querySelectorAll(".share-x").forEach((link) => {
    link.href = shareUrls.x;
  });

  articleElement.querySelector(".copy-link").addEventListener("click", async (event) => {
    const button = event.currentTarget;

    try {
      await navigator.clipboard.writeText(article.url);
      button.innerHTML = '<i class="bi bi-check-lg"></i>';
      button.setAttribute("aria-label", "Enlace copiado");

      window.setTimeout(() => {
        button.innerHTML = '<i class="bi bi-link-45deg"></i>';
        button.setAttribute("aria-label", "Copiar enlace");
      }, 1800);
    } catch {
      window.prompt("Copia el enlace de la noticia:", article.url);
    }
  });
}

function renderTags(container, tags) {
  const articleTags = tags?.length ? tags : ["Tecnología"];

  articleTags.forEach((tag) => {
    const tagLink = document.createElement("a");
    tagLink.className = "tag-link";
    tagLink.href = `https://dev.to/t/${encodeURIComponent(tag)}`;
    tagLink.target = "_blank";
    tagLink.rel = "noopener";
    tagLink.textContent = `#${tag}`;
    container.append(tagLink);
  });
}

function renderArticle(article, position) {
  const fragment = articleTemplate.content.cloneNode(true);
  const articleElement = fragment.querySelector(".news-article");
  const category = getCategory(article);
  const mainImage = article.cover_image || article.social_image;
  const articleDate = article.published_at || article.created_at;

  articleElement.id = `noticia-${position}`;
  articleElement.dataset.articleId = article.id;
  articleElement.querySelector(".article-number").textContent = `Noticia ${position} de ${MAX_ARTICLES}`;

  const categoryLink = articleElement.querySelector(".article-category");
  categoryLink.textContent = category;
  categoryLink.href = `https://dev.to/t/${encodeURIComponent(category)}`;
  categoryLink.target = "_blank";
  categoryLink.rel = "noopener";

  articleElement.querySelector(".article-title").textContent = article.title;
  articleElement.querySelector(".article-description").textContent =
    article.description || "Artículo publicado en DEV Community.";

  const authorImage = articleElement.querySelector(".author-image");
  authorImage.src = article.user.profile_image_90 || article.user.profile_image;
  authorImage.alt = `Foto de ${article.user.name}`;

  const authorName = articleElement.querySelector(".author-name");
  authorName.textContent = article.user.name;
  authorName.href = `https://dev.to/${article.user.username}`;

  const timeElement = articleElement.querySelector(".article-date");
  timeElement.dateTime = articleDate;
  timeElement.textContent = formatDate(articleDate);

  const articleImage = articleElement.querySelector(".article-image");
  articleImage.src = mainImage;
  articleImage.alt = article.title;
  articleImage.addEventListener("error", () => {
    articleImage.src = article.social_image;
  });
  articleElement.querySelector(".image-caption").textContent =
    `${article.title} - Imagen: ${article.user.name} / DEV Community`;

  articleElement.querySelector(".article-body").innerHTML = article.body_html;
  renderTags(articleElement.querySelector(".article-tags"), article.tags || article.tag_list);
  setShareLinks(articleElement, article);

  articlesContainer.append(fragment);
}

function showError(message, isInitialError = false) {
  errorText.textContent = message;
  errorMessage.classList.remove("d-none");
  retryButton.dataset.initial = String(isInitialError);
}

function hideError() {
  errorMessage.classList.add("d-none");
}

function finishInfiniteScroll() {
  observer?.disconnect();
  scrollLoader.classList.add("d-none");
  endMessage.classList.remove("d-none");
}

async function loadNextArticle() {
  if (isLoading || nextArticleIndex >= articleList.length || loadedArticleIds.size >= MAX_ARTICLES) {
    return;
  }

  isLoading = true;
  hideError();

  if (loadedArticleIds.size > 0) {
    scrollLoader.classList.remove("d-none");
  }

  const listArticle = articleList[nextArticleIndex];

  try {
    const article = await requestJson(`${ARTICLE_API_URL}/${listArticle.id}`);

    if (!loadedArticleIds.has(article.id)) {
      loadedArticleIds.add(article.id);
      renderArticle(article, loadedArticleIds.size);
    }

    nextArticleIndex += 1;

    if (loadedArticleIds.size >= MAX_ARTICLES || nextArticleIndex >= articleList.length) {
      finishInfiniteScroll();
    }
  } catch (error) {
    showError(`No se pudo cargar la siguiente noticia. ${error.message}`);
  } finally {
    isLoading = false;
    initialLoader.classList.add("d-none");
    scrollLoader.classList.add("d-none");
  }
}

function startInfiniteScroll() {
  // El observador se activa después del primer scroll para garantizar
  // que al inicio únicamente se muestre una noticia.
  window.addEventListener(
    "scroll",
    () => {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadNextArticle();
          }
        },
        {
          root: null,
          rootMargin: "0px 0px 450px 0px",
          threshold: 0,
        },
      );

      observer.observe(scrollSentinel);
    },
    { once: true, passive: true },
  );
}

async function initializeArticles() {
  initialLoader.classList.remove("d-none");
  hideError();

  try {
    const articles = await requestJson(API_URL);

    articleList = articles.slice(0, MAX_ARTICLES);

    if (articleList.length === 0) {
      throw new Error("La API no devolvió artículos.");
    }

    await loadNextArticle();
    startInfiniteScroll();
  } catch (error) {
    initialLoader.classList.add("d-none");
    showError(`No fue posible iniciar la aplicación. ${error.message}`, true);
  }
}

retryButton.addEventListener("click", async () => {
  const isInitialError = retryButton.dataset.initial === "true";

  if (isInitialError) {
    await initializeArticles();
  } else {
    await loadNextArticle();
  }
});

initializeArticles();
