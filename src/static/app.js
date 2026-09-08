document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const searchInput = document.getElementById("activity-search");
  const categoryFilter = document.getElementById("category-filter");
  const sortSelect = document.getElementById("sort-activities");
  const resultsSummary = document.getElementById("results-summary");
  let allActivities = {};
  let currentView = "list";

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      allActivities = await response.json();
      populateCategories();
      populateActivitySelect();
      renderActivities();
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  function populateCategories() {
    const categories = [...new Set(
      Object.values(allActivities).map((activity) => activity.category)
    )].sort();

    categoryFilter.innerHTML = '<option value="all">All categories</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }

  function populateActivitySelect() {
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';
    Object.keys(allActivities).sort().forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    });
  }

  function getFilteredActivities() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;

    return Object.entries(allActivities)
      .filter(([name, details]) => {
        const matchesSearch = !searchTerm ||
          `${name} ${details.description}`.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === "all" ||
          details.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort(([nameA, detailsA], [nameB, detailsB]) => {
        if (sortSelect.value === "category") {
          return detailsA.category.localeCompare(detailsB.category) ||
            nameA.localeCompare(nameB);
        }
        if (sortSelect.value === "date") {
          return detailsA.next_session.localeCompare(detailsB.next_session) ||
            nameA.localeCompare(nameB);
        }
        return nameA.localeCompare(nameB);
      });
  }

  function renderActivities() {
    const filteredActivities = getFilteredActivities();
    resultsSummary.textContent = `${filteredActivities.length} of ${
      Object.keys(allActivities).length
    } activities shown`;
    activitiesList.innerHTML = "";

    if (filteredActivities.length === 0) {
      activitiesList.innerHTML =
        '<p class="empty-state">No activities match your search and filters.</p>';
      return;
    }

    if (currentView === "calendar") {
      renderCalendarView(filteredActivities);
    } else {
      const cards = document.createElement("div");
      cards.className = "activity-grid";
      filteredActivities.forEach(([name, details]) => {
        cards.appendChild(createActivityCard(name, details));
      });
      activitiesList.appendChild(cards);
    }

  }

  function renderCalendarView(filteredActivities) {
    const groupedByDate = filteredActivities.reduce((groups, [name, details]) => {
      groups[details.next_session] ??= [];
      groups[details.next_session].push([name, details]);
      return groups;
    }, {});

    Object.entries(groupedByDate).sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .forEach(([sessionDate, activitiesForDate]) => {
        const dateGroup = document.createElement("section");
        dateGroup.className = "calendar-day";
        const dateHeading = document.createElement("h4");
        dateHeading.textContent = new Date(`${sessionDate}T00:00:00`)
          .toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
        dateGroup.appendChild(dateHeading);
        const cards = document.createElement("div");
        cards.className = "activity-grid";
        activitiesForDate.forEach(([name, details]) => {
          cards.appendChild(createActivityCard(name, details));
        });
        dateGroup.appendChild(cards);
        activitiesList.appendChild(dateGroup);
      });
  }

  function createActivityCard(name, details) {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button type="button" class="delete-btn" data-activity="${name}" data-email="${email}" aria-label="Unregister ${email} from ${name}">❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <span class="category-tag">${details.category}</span>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Next session:</strong> ${new Date(`${details.next_session}T00:00:00`)
            .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;
        return activityCard;
    }
  // Handle unregister functionality
  async function handleUnregister(button) {
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  activitiesList.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-btn");
    if (button) {
      handleUnregister(button);
    }
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  [searchInput, categoryFilter, sortSelect].forEach((control) => {
    control.addEventListener("input", renderActivities);
    control.addEventListener("change", renderActivities);
  });

  document.querySelectorAll(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      currentView = button.dataset.view;
      document.querySelectorAll(".view-button").forEach((viewButton) => {
        viewButton.classList.toggle("active", viewButton === button);
      });
      renderActivities();
    });
  });

  // Initialize app
  fetchActivities();
});
