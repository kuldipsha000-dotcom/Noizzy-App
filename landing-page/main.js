// Intersection Observer for reveal animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
    // Observe all reveal elements
    document.querySelectorAll('.reveal, .reveal-delay, .reveal-delay-2').forEach(el => {
        observer.observe(el);
    });

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Navbar transparency/blur on scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(3, 0, 20, 0.8)';
            navbar.style.top = '0';
            navbar.style.width = '100%';
            navbar.style.maxWidth = '100%';
            navbar.style.borderRadius = '0';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.03)';
            navbar.style.top = '1.5rem';
            navbar.style.width = '90%';
            navbar.style.maxWidth = '1100px';
            navbar.style.borderRadius = '24px';
        }
    });

    // Lightbox Logic
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeLightbox = document.querySelector('.close-lightbox');

    document.querySelectorAll('.zoomable').forEach(img => {
        img.addEventListener('click', () => {
            lightboxImg.src = img.src;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scroll
        });
    });

    const closeLightboxFn = () => {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
    };

    closeLightbox.addEventListener('click', closeLightboxFn);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightboxFn();
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightboxFn();
    });
});
