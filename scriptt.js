// Smooth Scroll for Donate Button
function scrollToSection(sectionId) {
    document.getElementById(sectionId).scrollIntoView({
        behavior: "smooth"
    });
}

// Donor Form Validation
document.getElementById("donorForm").addEventListener("submit", function(e) {
    e.preventDefault();

    let age = document.getElementById("age").value;
    let phone = document.getElementById("phone").value;

    if (age < 18 || age > 65) {
        alert("Donor age must be between 18 and 65.");
        return;
    }

    if (phone.length !== 10 || isNaN(phone)) {
        alert("Enter a valid 10-digit phone number.");
        return;
    }

    alert("Donor Registered Successfully!");
    this.reset();
});