const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    menuToggle.classList.toggle('active');
});

function closeMenu() {
    navLinks.classList.remove('active');
    menuToggle.classList.remove('active');
}

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

const schedules = {
    0: '4:00 PM – 12:30 AM',
    1: '4:00 PM – 12:45 AM',
    2: '4:00 PM – 12:45 AM',
    3: '4:00 PM – 12:45 AM',
    4: '4:00 PM – 12:45 AM',
    5: '4:00 PM – 1:00 AM',
    6: '4:00 PM – 2:00 AM'
};

const today = new Date().getDay();
document.getElementById('todaySchedule').textContent = schedules[today];

document.querySelectorAll('.schedule-row').forEach(row => {
    if (parseInt(row.dataset.day) === today) {
        row.classList.add('today');
    }
});

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
