const areaFilter = document.getElementById(
    "areaFilter"
) as HTMLSelectElement;

const suiteFilter = document.getElementById(
    "suiteFilter"
) as HTMLSelectElement;

const priorityFilter = document.getElementById(
    "priorityFilter"
) as HTMLSelectElement;

const searchFilter = document.getElementById(
    "searchFilter"
) as HTMLInputElement;

const testcaseEls = Array.from(
    document.querySelectorAll<HTMLElement>(
        ".testcase"
    )
);

const allSuiteOptions = Array.from(
    suiteFilter.options
).slice(1);

const areaToSuites: Record<
    string,
    Set<string>
> = {};

testcaseEls.forEach((card) => {
    const area = card.dataset.area ?? "";
    const suite = card.dataset.suite ?? "";

    if (!areaToSuites[area]) {
        areaToSuites[area] = new Set();
    }

    areaToSuites[area].add(suite);
});

function updateSuiteOptions(): void {
    const selectedArea = areaFilter.value;
    const currentSuite = suiteFilter.value;

    const allowedSuites = selectedArea
        ? areaToSuites[selectedArea] ??
        new Set<string>()
        : null;

    suiteFilter.innerHTML = "";

    const allOption = document.createElement(
        "option"
    );

    allOption.value = "";
    allOption.textContent = "All Suites";
    suiteFilter.appendChild(allOption);

    allSuiteOptions.forEach((opt) => {
        if (
            !allowedSuites ||
            allowedSuites.has(opt.value)
        ) {
            suiteFilter.appendChild(
                opt.cloneNode(true)
            );
        }
    });

    const stillValid = Array.from(
        suiteFilter.options
    ).some(
        (o) => o.value === currentSuite
    );

    suiteFilter.value = stillValid
        ? currentSuite
        : "";
}

function updateGroupVisibility(): void {
    document
        .querySelectorAll<HTMLElement>(
            ".suite-group"
        )
        .forEach((group) => {
            const cards = Array.from(
                group.querySelectorAll<HTMLElement>(
                    ".testcase"
                )
            );

            const visibleCount = cards.filter(
                (card) =>
                    card.style.display !==
                    "none"
            ).length;

            const countEl =
                group.querySelector<HTMLElement>(
                    ".suite-count"
                );

            if (countEl) {
                const total =
                    countEl.dataset.total ??
                    String(cards.length);

                countEl.textContent =
                    "(" +
                    visibleCount +
                    "/" +
                    total +
                    ")";
            }

            group.style.display =
                visibleCount > 0 ? "" : "none";
        });

    document
        .querySelectorAll<HTMLElement>(
            ".priority"
        )
        .forEach((p) => {
            const visible = Array.from(
                p.querySelectorAll<HTMLElement>(
                    ".suite-group"
                )
            ).some(
                (group) =>
                    group.style.display !==
                    "none"
            );

            p.style.display = visible
                ? ""
                : "none";
        });
}

function setText(
    id: string,
    value: string
): void {
    const el = document.getElementById(id);

    if (el) {
        el.textContent = value;
    }
}

function updateStats(): void {
    let total = 0;
    let withBugs = 0;
    let withoutBugs = 0;
    let activeBugs = 0;
    let closedBugs = 0;
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let notRun = 0;

    testcaseEls.forEach((card) => {
        if (card.style.display === "none") {
            return;
        }

        total++;

        const active = Number(
            card.dataset.bugActive || 0
        );

        const closed = Number(
            card.dataset.bugClosed || 0
        );

        activeBugs += active;
        closedBugs += closed;

        if (active > 0) {
            withBugs++;
        } else {
            withoutBugs++;
        }

        if (card.dataset.outcome === "Passed") {
            passed++;
        } else if (
            card.dataset.outcome === "Failed"
        ) {
            failed++;
        } else if (
            card.dataset.outcome === "Blocked"
        ) {
            blocked++;
        } else {
            notRun++;
        }
    });

    const passRate =
        total > 0
            ? Math.round(
                (passed / total) * 1000
            ) / 10
            : 0;

    setText("statTotal", String(total));
    setText(
        "statWithBugs",
        "🔴 " + withBugs
    );
    setText(
        "statWithoutBugs",
        "✅ " + withoutBugs
    );
    setText(
        "statActiveBugs",
        "🐞 " + activeBugs
    );
    setText(
        "statClosedBugs",
        "✔ " + closedBugs
    );
    setText("statPassed", "✅ " + passed);
    setText("statFailed", "❌ " + failed);
    setText("statBlocked", "⛔ " + blocked);
    setText("statNotRun", "⬜ " + notRun);
    setText("statPassRate", passRate + "%");
}

function applyFilters(): void {
    const selectedArea = areaFilter.value;
    const selectedSuite = suiteFilter.value;
    const selectedPriority =
        priorityFilter.value;

    const searchTerm = searchFilter.value
        .trim()
        .toLowerCase();

    testcaseEls.forEach((card) => {
        const area = card.dataset.area;
        const suite = card.dataset.suite;
        const priority = card.dataset.priority;

        const title = (
            card.dataset.title || ""
        ).toLowerCase();

        const areaMatch =
            !selectedArea ||
            area === selectedArea;

        const suiteMatch =
            !selectedSuite ||
            suite === selectedSuite;

        const priorityMatch =
            !selectedPriority ||
            priority === selectedPriority;

        const searchMatch =
            !searchTerm ||
            title.includes(searchTerm);

        card.style.display =
            areaMatch &&
            suiteMatch &&
            priorityMatch &&
            searchMatch
                ? "block"
                : "none";
    });

    updateGroupVisibility();
    updateStats();
}

areaFilter.addEventListener("change", () => {
    updateSuiteOptions();
    applyFilters();
});

suiteFilter.addEventListener(
    "change",
    applyFilters
);

priorityFilter.addEventListener(
    "change",
    applyFilters
);

searchFilter.addEventListener(
    "input",
    applyFilters
);

const urlParams = new URLSearchParams(
    window.location.search
);

const suiteParam = urlParams.get("suite");

if (suiteParam) {
    suiteFilter.value = suiteParam;
}

applyFilters();
