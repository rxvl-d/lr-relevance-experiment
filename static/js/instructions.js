const DEFAULT_INSTRUCT_HELP= `
Verwenden Sie die Schaltflächen << und >>, um durch die Abschnitte zu blättern. Sie müssen
alle Anweisungen auf einer Seite befolgen, bevor Sie zur nächsten Seite gelangen können.
Wenn Sie nicht weiterkommen, klicken Sie auf << und dann auf >>, um den Abschnitt erneut zu beginnen.
`

class Instructions {
  constructor(options={}) {
    _.defaults(options, {
      width: 1000,
      promptHeight: 100,
      helpText: DEFAULT_INSTRUCT_HELP
    })

    this.options = options

    this.div = $('<div>')
    .css({
      width: options.width,
      position: 'relative',
      margin: 'auto',
      padding: '10px',
    })

    let help = $('<button>')
    .appendTo(this.div)
    .addClass('btn-help')
    .text('?')
    .click(async () => {
      await Swal.fire({
          title: 'Help',
          html: options.helpText,
          icon: 'info',
          confirmButtonText: 'Got it!',
        })
    })

    this.btnPrev = $('<button>')
    .addClass('btn')
    .text('<<')
    .css({
      position: 'absolute',
      top: '20px',
      left: '30px',
    })
    .click(() => this.runPrev())
    .prop('disabled', true)
    .appendTo(this.div)

    this.btnNext = $('<button>')
    .addClass('btn')
    .text('>>')
    .css({
      position: 'absolute',
      top: '20px',
      right: '200px',
    })
    .click(() => this.runNext())
    .prop('disabled', true)
    .appendTo(this.div)

    this.title = $('<h1>')
    .addClass('text').appendTo(this.div)

    this.prompt = $('<div>')
    .addClass('text')
    .css({
      height: options.promptHeight,
      marginTop: 20
    })
    .appendTo(this.div)

    this.content = $('<div>').appendTo(this.div)

    this.stage = 0
    this.maxStage = 0
    this.stages = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
    .filter(f => f.startsWith('stage'))
    .map(f => this[f])

    this.completed = makePromise()

  }

  attach(display) {
    display.empty()
    this.div.appendTo(display)
    return this
  }

  async run(display, stage) {
    if (display) this.attach(display)
    if (stage == undefined && urlParams.instruct) {
      stage = parseInt(urlParams.instruct)
    }
    this.runStage(stage ?? 1)
    await this.completed
  }

  sleep(ms) {
    // this allows us to cancel sleeps when the user flips to a new page
    this._sleep = makePromise()
    sleep(ms).then(() => this._sleep.resolve())
    return this._sleep
  }

  setPrompt(md) {
    this.prompt.html(markdown(md))
  }
  appendPrompt(md) {
    this.prompt.append(markdown(md))
  }

  async button(text='continue', opts={}) {
    _.defaults(opts, {delay: 0})
    let btn = button(this.prompt, text, opts)
    await btn.clicked
    btn.remove()
  }

  async runStage(n) {
    logEvent(`instructions.runStage.${n}`, {stage: this.stages[n-1].name})
    this._sleep?.reject()
    this.prompt.empty()
    this.content.empty()
    this.content.css({opacity: 1}) // just to be safe
    this.maxStage = Math.max(this.maxStage, n)
    this.stage = n
    this.btnNext.prop('disabled', this.stage >= this.maxStage)
    this.btnPrev.prop('disabled', this.stage <= 1)
    this.title.text(`Instructions (${this.stage}/${this.stages.length})`)

    await this.stages[n-1].bind(this)()
    if (this.stage == n) {
      // check to make sure we didn't already move forward
      this.enableNext()
    }
  }

  runNext() {
    saveData()
    logEvent('instructions.runNext')
    this.btnNext.removeClass('btn-pulse')
    if (this.stage == this.stages.length) {
      logEvent('instructions.completed')
      psiturk.finishInstructions();
      this.completed.resolve()
      this.div.remove()
    } else {
      this.runStage(this.stage + 1)
    }
  }

  runPrev() {
    logEvent('instructions.runPrev')
    this.runStage(this.stage - 1)
  }

  enableNext() {
    this.btnNext.addClass('btn-pulse')
    this.maxStage = this.stage + 1
    this.btnNext.prop('disabled', false)
  }
}


class ExampleInstructions extends Instructions {
  constructor(options={}) {
    super(options)
    if (!PARAMS.showSecretStage) {
      this.stages = this.stages.filter(stage => {
        return stage.name != 'stage_conditional'
      })
    }
  }

  // the stages run in the order that they're defined
  // you can jump to a specific stage using it's position e.g.
  // http://127.0.0.1:8000/?instruct=2

  async stage_welcome() {
    this.setPrompt(`
      Vielen Dank für Ihre Teilnahme! Wir beginnen mit einigen kurzen Anweisungen.

      _Verwenden Sie die Pfeile oben zum Navigieren_
    `)
  }

  result_prompt(need, query, result) {
    return `
      <font color="red">_„Informationsbedürfnis“_ </font>: ${need}

      <font color="green">_„Abfrage“_</font>: ${query}

      <font color="blue">„Ergebnis“</font>: <a href="${result}" target="_blank">${result}</a>
      
      -----

      **Relevanz**:
    `
  }

  relevance_radio_buttons() { return new RadioButtons({
    choices: [
    '1 - Ich weiß nicht genug, um dieses Urteil zu fällen',
    '2 - Nicht genug Zeit, um eine Entscheidung zu treffen',
    '3 - Spam',
    '4 - Nicht so relevant für den Lehrer',
    '5 - Könnte für den Lehrer relevant sein',
    '6 - Genau das, was der Lehrer braucht' ],
    name: 'relevance'
  }) }


  summary_prompt(need, query, summary) {
    return `
      <font color="red">_„Informationsbedürfnis“_ </font>: ${need}

      <font color="green">_„Abfrage“_</font>: ${query}

      <font color="GoldenRod">_„Zusammenfassung“_</font>: 

${summary}      
      -----

      **Relevanz**:
    `
  }

  async stage_instructions() {
    this.setPrompt(`
In dieser Studie werden Sie gebeten, die Relevanz einiger _„Inhalte“_ für eine Suche zu bewerten, die von einem Physik- oder Chemielehrer der 7. bis 10. Klasse durchgeführt wird.

Wenn ein Lehrer eine Suche durchführt, hat er ein <font color="red">_„Informationsbedürfnis“_</font>, 
das in einer Aussage wie der folgenden ausgedrückt wird: 
_„Finde eine umfassende Zusammenfassung der Newtonschen Gesetze und ihrer Anwendungen in der Dynamik.“_

Dann versucht er, dieses <font color="red">_„Informationsbedürfnis“_</font> zu befriedigen, 
indem er eine <font color="green">_„Abfrage“_</font> wie 
_„Überblick Newtonsche Gesetze“_ an eine Suchmaschine sendet.

Als Ergebnis gibt die Suchmaschine mehrere mögliche <font color="blue">„Ergebnisse“</font> 
(z.B. https://naturwissenschaften.bildung-rp.de/...) 
mit einer kleinen <font color="GoldenRod">_„Zusammenfassung“_</font> wie dieser:

-----

![Zusammenfassung Beispiel](static/search_summary_example.png)

-----

In dieser Studie werden wir Sie fragen, wie relevant sowohl eine <font color="GoldenRod">„Zusammenfassung“</font> als auch ein 
<font color="blue">„Ergebnis“</font> für ein <font color="red">„Informationsbedürfnis“</font> und die damit verbundene 
<font color="green">„Abfrage“</font> sind.

Nachdem Sie versucht haben, Ihr Urteil zu fällen, müssen Sie eine der folgenden Optionen auswählen.:
1 - Ich weiß nicht genug, um dieses Urteil zu fällen
2 - Nicht genug Zeit, um eine Entscheidung zu treffen
3 - Spam
4 - Nicht so relevant für den Lehrer
5 - Könnte für den Lehrer relevant sein
6 - Genau das, was der Lehrer braucht

<div class="alert alert-danger">
<b>Achtung!</b><br>
Verbringen Sie nicht mehr als eine Minute mit jeder Aufgabe.
Wenn Sie innerhalb einer Minute keine Entscheidung treffen können, wählen Sie Option 2.
</div>

Jetzt werden wir einige praktische Bewertungen durchführen und dann mit der eigentlichen Studie beginnen.
    `)
  }

  async stage_result_relevance_example() {
    this.setPrompt(this.result_prompt(
      'Finde eine zusammenfassende Darstellung der wichtigsten Strukturen und Eigenschaften organischer Verbindungen wie Alkane, Alkanole und Aromaten.',
      'Überblick Strukturen Eigenschaften organische Verbindungen',
      'https://www.raabits.de/unterrichtsmaterial/chemie/organische-chemie'
    ))
    let radio = this.relevance_radio_buttons().appendTo(this.prompt)
    let click = await radio.promise()
    let choice = parseInt(click.split(' - ')[0])
    if (choice == 5) {
      this.runPrev() // TODO: end the instructions early
    } else {
      this.runNext()
    }
  }

  async stage_summary_relevance_example() {
    this.setPrompt(this.summary_prompt(
      'Finde eine zusammenfassende Darstellung der wichtigsten Strukturen und Eigenschaften organischer Verbindungen wie Alkane, Alkanole und Aromaten.',
      'Überblick Strukturen Eigenschaften organische Verbindungen',
      `-----
      
##### https://www.raabits.de › unterrichtsmaterial › organische-... 

#### Organische Chemie

**Organische** Chemie und **Organische** Stoffe ▻ Stoffgruppen und Reaktionen: ✓ **Organische** Reaktionen ✓ Funktionelle Gruppen ✓ Nomenklatur ✓ Alkane und Ester.

` 
    ))
    let radio = this.relevance_radio_buttons().appendTo(this.prompt)
    let click = await radio.promise()
    let choice = parseInt(click.split(' - ')[0])
    if (choice == 5) {
      this.runPrev() // TODO: end the instructions early
    } else {
      this.runNext()
    }
  }

  async stage_final() {
    // I suggest keeping something like this here to warn participants to not refresh

    this.setPrompt(`
      Im weiteren Verlauf des Experiments erhalten Sie eine Mischung dieser beiden Abfragetypen in zufälliger Reihenfolge.

<br><br>
<div class="alert alert-danger">
<b>Achtung!</b><br>
Nachdem Sie die Anweisungen ausgeführt haben, <strong>können Sie die Seite nicht aktualisieren</strong>.
Wenn Sie dies tun, erhalten Sie eine Fehlermeldung und können die
Studie nicht abschließen.
</div>
    `)
    let question = 'Möchten Sie die Seite aktualisieren, nachdem Sie die Anweisungen abgeschlossen haben?'
    let radio = radio_buttons(this.prompt, question, ['Ja', 'Nein'])
    let post = $('<div>').appendTo(this.prompt)
    let no = makePromise()
    let done = false
    radio.click((val) => {
      if (val == 'yes') {
        post.html("Sie müssen akzeptieren.")
      } else {
        no.resolve()
      }
    })
    await no
    radio.buttons().off()
    radio.buttons().prop('disabled', true)
    await this.button('Weiter')
    this.runNext() // don't make them click the arrow
  }
}